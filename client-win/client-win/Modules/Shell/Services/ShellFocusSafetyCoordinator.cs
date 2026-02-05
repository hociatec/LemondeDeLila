using System;
using System.Threading;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Shell-scoped NVDA mitigation: keeps keyboard/UIA focus on a usable element during navigation/refresh
/// without stealing focus from other applications (no global idle hooks).
/// </summary>
internal sealed class ShellFocusSafetyCoordinator : IDisposable
{
    private readonly Window _window;
    private readonly ProcessInputEventHandler _postProcessInput;
    private readonly KeyboardFocusChangedEventHandler _gotKeyboardFocus;
    private readonly RoutedEventHandler _unloaded;
    private int _checking;

    public ShellFocusSafetyCoordinator(Window window)
    {
        _window = window ?? throw new ArgumentNullException(nameof(window));

        _postProcessInput = OnPostProcessInput;
        _gotKeyboardFocus = OnGotKeyboardFocus;
        _unloaded = OnUnloaded;

        try
        {
            if (InputManager.Current != null)
            {
                InputManager.Current.PostProcessInput += _postProcessInput;
            }
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
        try
        {
            if (InputManager.Current != null)
            {
                InputManager.Current.PostProcessInput -= _postProcessInput;
            }
        }
        catch
        {
            // best-effort
        }

        try { _window.RemoveHandler(Keyboard.GotKeyboardFocusEvent, _gotKeyboardFocus); } catch { }
        try { _window.RemoveHandler(FrameworkElement.UnloadedEvent, _unloaded); } catch { }
    }

    private void OnPostProcessInput(object? sender, ProcessInputEventArgs e)
    {
        try
        {
            if (e?.StagingItem?.Input is not (KeyboardEventArgs or MouseEventArgs))
            {
                return;
            }

            EnsureFocusHealthy();
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
                FocusParking.Park(_window);
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
                FocusParking.Park(_window);
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
                FocusParking.Park(_window);
                return;
            }

            if (focusTarget is UIElement uie)
            {
                if (!uie.IsVisible || !uie.IsEnabled)
                {
                    FocusParking.Park(_window);
                }
                return;
            }

            if (focusTarget is FrameworkElement fe)
            {
                if (!fe.IsVisible || !fe.IsEnabled)
                {
                    FocusParking.Park(_window);
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
}
