using System;
using System.Windows;
using System.Windows.Input;
using client_win.Core.Diagnostics;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    private void BeginFocusPass()
    {
        using var _ = PerfTrace.Measure("nav.focusPass");
        if (!IsLoaded)
        {
            return;
        }

        try
        {
            var win = Window.GetWindow(this) ?? Application.Current?.MainWindow;
            if (_previous != null)
            {
                FocusParking.ForcePark(win);
            }
            else
            {
                FocusParking.ParkIfNeeded(win);
            }
        }
        catch
        {
            /* ignore */
        }

        try { UpdatePresenterVisibilities(); } catch { /* ignore */ }

        if (TryFocusAndMaybeFinalize())
        {
            return;
        }

        Dispatcher.BeginInvoke((Action)(() => TryFocusAndMaybeFinalize()), System.Windows.Threading.DispatcherPriority.Loaded);
        Dispatcher.BeginInvoke((Action)(() => TryFocusAndMaybeFinalize()), System.Windows.Threading.DispatcherPriority.ApplicationIdle);
        HookCurrentRootObservers();
    }

    private bool TryFocusAndMaybeFinalize()
    {
        try
        {
            var window = Window.GetWindow(this) ?? Application.Current?.MainWindow;
            if (window != null && !window.IsActive)
            {
                return false;
            }

            if (TryFocusCurrent())
            {
                FinalizeTransitionIfSafe();
                if (_previous == null)
                {
                    DetachCurrentRootObservers();
                }
                return true;
            }

            FinalizeTransitionIfSafe();
            if (_previous == null)
            {
                DetachCurrentRootObservers();
            }
            return false;
        }
        catch
        {
            return false;
        }
    }

    private bool TryFocusCurrent()
    {
        using var _ = PerfTrace.Measure("nav.tryFocusCurrent");
        if (_current == null)
        {
            return false;
        }

        var root = CachedContentHostVisualTree.TryGetPresenterRoot(_current.Presenter);
        if (root == null)
        {
            return false;
        }

        if (PresentationSource.FromDependencyObject(root) == null)
        {
            return false;
        }

        HookFocusReadyIfNeeded(root);

        if (_currentFocusReady is { IsFocusReady: false })
        {
            return false;
        }

        if (!CachedContentHostVisualTree.IsFocusWithin(root) &&
            TryRestoreLastFocus(_current.Content, root))
        {
            return true;
        }

        if (root is IInitialFocusTarget focusTarget)
        {
            if (!CachedContentHostVisualTree.IsFocusWithin(root))
            {
                try { focusTarget.RequestInitialFocus(); } catch { /* ignore */ }
            }
            if (CachedContentHostVisualTree.IsFocusWithin(root))
            {
                return true;
            }

            return false;
        }

        if (CachedContentHostVisualTree.FindFirstFocusable(root) is IInputElement target)
        {
            try { (target as UIElement)?.Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(target); } catch { /* ignore */ }
            return CachedContentHostVisualTree.IsFocusWithin(root);
        }

        return false;
    }
}
