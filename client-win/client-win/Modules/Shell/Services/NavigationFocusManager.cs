using System;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using Serilog;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Centralized focus strategy for shell navigation.
/// Goal: avoid NVDA "non disponible" announcements caused by the focused element disappearing during view swaps.
/// </summary>
public sealed class NavigationFocusManager : INavigationFocusManager
{
    private const int FocusRetryMaxAttempts = 40;
    private static readonly TimeSpan FocusRetryInterval = TimeSpan.FromMilliseconds(100);

    private readonly Dispatcher _dispatcher;
    private DispatcherTimer? _retryTimer;
    private int _retryRemaining;
    private int _navId;
    private int _navToken;

    public NavigationFocusManager(Dispatcher dispatcher)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
    }

    public void BeforeNavigation()
    {
        if (!_dispatcher.CheckAccess())
        {
            _dispatcher.Invoke(BeforeNavigation, DispatcherPriority.Send);
            return;
        }

        try
        {
            _navToken = NavigationTransaction.Begin();

            var window = Application.Current?.MainWindow;
            if (window == null || (!window.IsActive && !window.IsKeyboardFocusWithin))
            {
                return;
            }

             // Move keyboard focus off the soon-to-disappear control.
             // IMPORTANT: avoid focusing RootHost here (it is a focus scope and can restore the last focused element
             // inside it). Prefer the FocusSentinel.
             FocusParking.ForcePark(window);
         }
         catch
         {
             // best-effort
        }
    }

    public void AfterNavigation(object newContent)
    {
        if (newContent == null)
        {
            return;
        }

        if (!_dispatcher.CheckAccess())
        {
            _dispatcher.Invoke(() => AfterNavigation(newContent), DispatcherPriority.Send);
            return;
        }

        try
        {
            _navId = unchecked(_navId + 1);
            _retryRemaining = FocusRetryMaxAttempts;

            // Fast attempts around layout/render boundaries.
            _dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() => TryEnsureInitialFocus(_navId)));
            _dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() => TryEnsureInitialFocus(_navId)));

            EnsureRetryTimer();
        }
        catch
        {
            // best-effort
        }
    }

    private void EnsureRetryTimer()
    {
        if (_retryTimer == null)
        {
            _retryTimer = new DispatcherTimer(DispatcherPriority.ApplicationIdle, _dispatcher)
            {
                Interval = FocusRetryInterval
            };
            _retryTimer.Tick += (_, _) =>
            {
                try
                {
                    if (_retryRemaining <= 0)
                    {
                        _retryTimer.Stop();
                        TryForceFallbackFocus();
                        NavigationTransaction.End(_navToken);
                        return;
                    }

                    _retryRemaining--;
                    TryEnsureInitialFocus(_navId);
                }
                catch
                {
                    // ignore
                }
            };
        }

        _retryTimer.Interval = FocusRetryInterval;
        _retryTimer.Start();
    }

    private void TryEnsureInitialFocus(int navId)
    {
        if (navId != _navId)
        {
            return;
        }

        try
        {
            var window = Application.Current?.MainWindow;
            if (window == null || (!window.IsActive && !window.IsKeyboardFocusWithin))
            {
                return;
            }

            var root = TryGetCurrentContentRoot(window);
            if (root == null || PresentationSource.FromDependencyObject(root) == null)
            {
                return;
            }

            // If focus is already in the new content, just sync UIA focus (helps NVDA catch up).
            if (IsFocusWithin(root))
            {
                SyncAutomationToCurrentFocus();
                StopRetryTimer();
                return;
            }

            // Preferred: let the view decide its initial focus.
            if (root is IInitialFocusTarget initialFocusTarget)
            {
                try { initialFocusTarget.RequestInitialFocus(); } catch { /* ignore */ }
            }

            if (IsFocusWithin(root))
            {
                SyncAutomationToCurrentFocus();
                StopRetryTimer();
                return;
            }

            // Fallback: focus the first focusable element in the new view.
            if (FindFirstFocusable(root) is UIElement target)
            {
                TryFocus(target);
                if (IsFocusWithin(root))
                {
                    TrySetAutomationFocus(target);
                    StopRetryTimer();
                }
            }
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "NavigationFocusManager.TryEnsureInitialFocus failed");
        }
    }

    private static void TryForceFallbackFocus()
    {
        try
        {
            var window = Application.Current?.MainWindow;
            if (window == null || (!window.IsActive && !window.IsKeyboardFocusWithin))
            {
                return;
            }

            var root = TryGetCurrentContentRoot(window);
            if (root == null)
            {
                // Absolute last resort: keep focus on RootHost/window (stable).
                if (TryGetRootHost(window) is UIElement host)
                {
                    TryFocus(host);
                    TrySetAutomationFocus(host);
                }
                else
                {
                    TryFocus(window);
                }
                return;
            }

            // If we already have focus in content, just sync UIA.
            if (IsFocusWithin(root))
            {
                SyncAutomationToCurrentFocus();
                return;
            }

            // Try focusing the first focusable element again, even if the view didn't implement IInitialFocusTarget.
            if (FindFirstFocusable(root) is UIElement target)
            {
                TryFocus(target);
                TrySetAutomationFocus(target);
                return;
            }

            // Otherwise focus the root itself if possible.
            if (root is UIElement uiRoot && uiRoot.IsVisible && uiRoot.IsEnabled)
            {
                TryFocus(uiRoot);
                TrySetAutomationFocus(uiRoot);
                return;
            }

            // Fallback: RootHost/window.
            if (TryGetRootHost(window) is UIElement host2)
            {
                TryFocus(host2);
                TrySetAutomationFocus(host2);
            }
            else
            {
                TryFocus(window);
            }
        }
        catch
        {
            // best-effort
        }
    }

    private void StopRetryTimer()
    {
        try { _retryTimer?.Stop(); } catch { /* ignore */ }
        try { NavigationTransaction.End(_navToken); } catch { /* ignore */ }
    }

    private static UIElement? TryGetRootHost(Window window)
    {
        try
        {
            var rootHost = window.FindName("RootHost");
            return rootHost as UIElement;
        }
        catch
        {
            return null;
        }
    }

    private static UIElement? TryGetFocusSentinel(Window window)
    {
        try
        {
            return window.FindName("FocusSentinel") as UIElement;
        }
        catch
        {
            return null;
        }
    }

    private static DependencyObject? TryGetCurrentContentRoot(Window window)
    {
        try
        {
            var rootHost = window.FindName("RootHost");
            if (rootHost is ICurrentContentRootProvider rootProvider)
            {
                return rootProvider.TryGetCurrentContentRoot();
            }

            if (rootHost is not ContentControl host)
            {
                return null;
            }

            if (host.Content is DependencyObject direct && PresentationSource.FromDependencyObject(direct) != null)
            {
                return direct;
            }

            if (FindDescendant<ContentPresenter>(host) is ContentPresenter presenter)
            {
                var children = VisualTreeHelper.GetChildrenCount(presenter);
                if (children > 0)
                {
                    return VisualTreeHelper.GetChild(presenter, 0);
                }
            }
        }
        catch
        {
            // best-effort
        }

        return null;
    }

    private static void TryFocus(IInputElement target)
    {
        try
        {
            if (target is UIElement ui)
            {
                ui.Focus();
            }
            Keyboard.Focus(target);
        }
        catch
        {
            // best-effort
        }
    }

    private static void SyncAutomationToCurrentFocus()
    {
        try
        {
            if (Keyboard.FocusedElement is not DependencyObject focused)
            {
                return;
            }

            var ui = FindAutomationFocusTarget(focused);
            if (ui != null)
            {
                TrySetAutomationFocus(ui);
            }
        }
        catch
        {
            // ignore
        }
    }

    private static UIElement? FindAutomationFocusTarget(DependencyObject start)
    {
        for (DependencyObject? current = start; current != null; current = GetParent(current))
        {
            if (current is UIElement ui &&
                ui.IsVisible &&
                ui.IsEnabled &&
                ui.Focusable)
            {
                return ui;
            }
        }

        return null;
    }

    private static void TrySetAutomationFocus(UIElement element)
    {
        try
        {
            if (!element.IsVisible || !element.IsEnabled)
            {
                return;
            }

            var peer = UIElementAutomationPeer.FromElement(element) ?? UIElementAutomationPeer.CreatePeerForElement(element);
            if (peer == null)
            {
                return;
            }

            try { peer.SetFocus(); } catch { /* ignore */ }
            try { peer.RaiseAutomationEvent(AutomationEvents.AutomationFocusChanged); } catch { /* ignore */ }
        }
        catch
        {
            // ignore
        }
    }

    private static DependencyObject? FindFirstFocusable(DependencyObject root)
    {
        try
        {
            if (root is Control c &&
                c.IsVisible &&
                c.IsEnabled &&
                c.IsHitTestVisible &&
                (c.Focusable || KeyboardNavigation.GetIsTabStop(c)))
            {
                return c;
            }

            if (root is UIElement u &&
                u.IsVisible &&
                u.IsEnabled &&
                u.IsHitTestVisible &&
                u.Focusable)
            {
                return u;
            }

            var count = VisualTreeHelper.GetChildrenCount(root);
            for (var i = 0; i < count; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child == null) continue;
                var found = FindFirstFocusable(child);
                if (found != null) return found;
            }
        }
        catch
        {
            // ignore
        }

        return null;
    }

    private static bool IsFocusWithin(DependencyObject root)
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        if (focused == null)
        {
            return false;
        }

        for (DependencyObject? current = focused; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, root))
            {
                return true;
            }
        }

        return false;
    }

    private static T? FindDescendant<T>(DependencyObject root) where T : DependencyObject
    {
        try
        {
            var count = VisualTreeHelper.GetChildrenCount(root);
            for (var i = 0; i < count; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child == null)
                {
                    continue;
                }

                if (child is T typed)
                {
                    return typed;
                }

                if (FindDescendant<T>(child) is T found)
                {
                    return found;
                }
            }
        }
        catch
        {
            // best-effort
        }

        return null;
    }

    private static DependencyObject? GetParent(DependencyObject current)
    {
        try
        {
            if (current is Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return VisualTreeHelper.GetParent(current);
            }
        }
        catch
        {
            // ignore
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }
}
