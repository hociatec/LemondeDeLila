using System;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Shell-scoped NVDA mitigation: keeps keyboard/UIA focus on a usable element during navigation/refresh
/// without stealing focus from other applications (no global idle hooks).
/// </summary>
internal sealed class ShellFocusSafetyCoordinator : IDisposable
{
    private readonly Window _window;
    private readonly KeyboardFocusChangedEventHandler _previewGotKeyboardFocus;
    private readonly KeyboardFocusChangedEventHandler _gotKeyboardFocus;
    private readonly RoutedEventHandler _unloaded;
    private int _checking;

    public ShellFocusSafetyCoordinator(Window window)
    {
        _window = window ?? throw new ArgumentNullException(nameof(window));

        _previewGotKeyboardFocus = OnPreviewGotKeyboardFocus;
        _gotKeyboardFocus = OnGotKeyboardFocus;
        _unloaded = OnUnloaded;

        try
        {
            // Intercept invalid focus transitions before they are committed.
            // This prevents NVDA from announcing transient/unloaded controls as "indisponible".
            _window.AddHandler(Keyboard.PreviewGotKeyboardFocusEvent, _previewGotKeyboardFocus, handledEventsToo: true);
        }
        catch
        {
            // best-effort
        }

        try
        {
            _window.AddHandler(Keyboard.GotKeyboardFocusEvent, _gotKeyboardFocus, handledEventsToo: true);
        }
        catch
        {
            // best-effort
        }

        try
        {
            // Catch focus disappearing when elements unload during navigation/template swap.
            _window.AddHandler(FrameworkElement.UnloadedEvent, _unloaded, handledEventsToo: true);
        }
        catch
        {
            // best-effort
        }
    }

    public void Dispose()
    {
        try { _window.RemoveHandler(Keyboard.PreviewGotKeyboardFocusEvent, _previewGotKeyboardFocus); } catch { }
        try { _window.RemoveHandler(Keyboard.GotKeyboardFocusEvent, _gotKeyboardFocus); } catch { }
        try { _window.RemoveHandler(FrameworkElement.UnloadedEvent, _unloaded); } catch { }
    }

    private void OnPreviewGotKeyboardFocus(object? sender, KeyboardFocusChangedEventArgs e)
    {
        try
        {
            // Never steal focus from other apps.
            if (!_window.IsActive)
            {
                return;
            }

            if (e.NewFocus is not DependencyObject newFocus)
            {
                return;
            }

            // If the target isn't attached to a PresentationSource, it's a transient/unloaded element.
            // Allowing the focus change is a common source of NVDA "indisponible".
            if (PresentationSource.FromDependencyObject(newFocus) == null)
            {
                e.Handled = true;
                FocusParking.ForcePark(_window);
                return;
            }

            // If the target is disabled/invisible, block it and recover focus.
            if (newFocus is UIElement uie)
            {
                if (!uie.IsVisible || !uie.IsEnabled)
                {
                    e.Handled = true;
                    FocusParking.ForcePark(_window);
                    return;
                }
            }
            else if (newFocus is FrameworkElement fe)
            {
                if (!fe.IsVisible || !fe.IsEnabled)
                {
                    e.Handled = true;
                    FocusParking.ForcePark(_window);
                    return;
                }
            }
        }
        catch
        {
            // best-effort
        }
    }

    private void OnGotKeyboardFocus(object? sender, KeyboardFocusChangedEventArgs e)
    {
        try
        {
            EnsureFocusHealthy(newFocus: e.NewFocus as DependencyObject);
        }
        catch
        {
            // best-effort
        }
    }

    private void OnUnloaded(object? sender, RoutedEventArgs e)
    {
        try
        {
            if (!_window.IsActive)
            {
                return;
            }

            var focused = Keyboard.FocusedElement as DependencyObject;
            if (focused == null)
            {
                return;
            }

            var unloaded = e.OriginalSource as DependencyObject;
            if (unloaded == null)
            {
                return;
            }

            // If the focused element is being unloaded, park focus before NVDA tries to announce it.
            if (IsDescendant(focused, unloaded))
            {
                FocusParking.ForcePark(_window);
            }
        }
        catch
        {
            // best-effort
        }
    }

    private void EnsureFocusHealthy(DependencyObject? newFocus = null)
    {
        if (Interlocked.Exchange(ref _checking, 1) == 1)
        {
            return;
        }

        try
        {
            // Never steal focus from other apps.
            if (!_window.IsActive)
            {
                return;
            }

            var focusTarget = newFocus ?? (Keyboard.FocusedElement as DependencyObject);
            if (focusTarget == null)
            {
                if (!TryRecoverFocusInCurrentContent())
                {
                    FocusParking.ParkIfNeeded(_window);
                }
                return;
            }

            // Only intervene for focus inside this window.
            var owner = Window.GetWindow(focusTarget);
            if (owner != null && !ReferenceEquals(owner, _window))
            {
                return;
            }

            if (PresentationSource.FromDependencyObject(focusTarget) == null)
            {
                if (!TryRecoverFocusInCurrentContent())
                {
                    FocusParking.ParkIfNeeded(_window);
                }
                return;
            }

            if (focusTarget is UIElement uie)
            {
                if (!uie.IsVisible || !uie.IsEnabled)
                {
                    if (!TryRecoverFocusInCurrentContent())
                    {
                        FocusParking.ParkIfNeeded(_window);
                    }
                }
                return;
            }

            if (focusTarget is FrameworkElement fe)
            {
                if (!fe.IsVisible || !fe.IsEnabled)
                {
                    if (!TryRecoverFocusInCurrentContent())
                    {
                        FocusParking.ParkIfNeeded(_window);
                    }
                }
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            Interlocked.Exchange(ref _checking, 0);
        }
    }

    private bool TryRecoverFocusInCurrentContent()
    {
        try
        {
            if (!_window.IsActive)
            {
                return false;
            }

            var root = TryGetContentRoot(_window);
            if (root == null)
            {
                return false;
            }

            if (root is IInitialFocusTarget initialFocusTarget)
            {
                initialFocusTarget.RequestInitialFocus();
                if (_window.IsKeyboardFocusWithin)
                {
                    return true;
                }
            }

            if (FindFirstFocusable(root) is IInputElement inputTarget)
            {
                try { Keyboard.Focus(inputTarget); } catch { /* ignore */ }
                return _window.IsKeyboardFocusWithin;
            }
        }
        catch
        {
            // best-effort
        }

        return false;
    }

    private static bool IsDescendant(DependencyObject node, DependencyObject ancestor)
    {
        for (DependencyObject? current = node; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, ancestor))
            {
                return true;
            }
        }
        return false;
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

    private static DependencyObject? TryGetContentRoot(Window window)
    {
        try
        {
            var rootHost = window.FindName("RootHost");
            if (rootHost is Views.StableContentHost stable)
            {
                return stable.TryGetCurrentContentRoot();
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

    private static T? FindDescendant<T>(DependencyObject root) where T : DependencyObject
    {
        try
        {
            var childrenCount = VisualTreeHelper.GetChildrenCount(root);
            for (var i = 0; i < childrenCount; i++)
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

    private static IInputElement? FindFirstFocusable(DependencyObject root)
    {
        try
        {
            if (root is UIElement element &&
                element.IsVisible &&
                element.IsEnabled &&
                element.Focusable)
            {
                return element;
            }

            var childrenCount = VisualTreeHelper.GetChildrenCount(root);
            for (var i = 0; i < childrenCount; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child == null)
                {
                    continue;
                }

                if (FindFirstFocusable(child) is IInputElement found)
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
}
