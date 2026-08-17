using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    private void HookFocusReadyIfNeeded(DependencyObject root)
    {
        if (root is not IFocusReady ready)
        {
            if (_currentFocusReady != null)
            {
                try { _currentFocusReady.FocusReadyChanged -= OnCurrentFocusReadyChanged; } catch { /* ignore */ }
                _currentFocusReady = null;
            }
            return;
        }

        if (ReferenceEquals(_currentFocusReady, ready) && _currentFocusReadyHookedForTransitionId == _transitionId)
        {
            return;
        }

        if (_currentFocusReady != null)
        {
            try { _currentFocusReady.FocusReadyChanged -= OnCurrentFocusReadyChanged; } catch { /* ignore */ }
        }

        _currentFocusReady = ready;
        _currentFocusReadyHookedForTransitionId = _transitionId;
        try { _currentFocusReady.FocusReadyChanged += OnCurrentFocusReadyChanged; } catch { /* ignore */ }
    }

    private void OnCurrentFocusReadyChanged(object? sender, EventArgs e)
    {
        try
        {
            var transitionId = _transitionId;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                if (transitionId != _transitionId)
                {
                    return;
                }

                if (TryFocusAndMaybeFinalize())
                {
                    DetachCurrentRootObservers();
                }
            }));
        }
        catch
        {
            // ignore
        }
    }

    private void HookCurrentRootObservers()
    {
        try
        {
            if (_current == null)
            {
                DetachCurrentRootObservers();
                return;
            }

            var root = CachedContentHostVisualTree.TryGetPresenterRoot(_current.Presenter) as FrameworkElement;
            if (root == null)
            {
                return;
            }

            if (ReferenceEquals(_observedCurrentRoot, root))
            {
                return;
            }

            DetachCurrentRootObservers();
            _observedCurrentRoot = root;
            _observedCurrentRootLoadedHandler = (_, _) => TryFocusAndMaybeFinalize();
            _observedCurrentRootLayoutUpdatedHandler = (_, _) => TryFocusAndMaybeFinalize();
            root.Loaded += _observedCurrentRootLoadedHandler;
            root.LayoutUpdated += _observedCurrentRootLayoutUpdatedHandler;
        }
        catch
        {
            // ignore
        }
    }

    private void DetachCurrentRootObservers()
    {
        try
        {
            if (_observedCurrentRoot != null)
            {
                if (_observedCurrentRootLoadedHandler != null)
                {
                    _observedCurrentRoot.Loaded -= _observedCurrentRootLoadedHandler;
                }

                if (_observedCurrentRootLayoutUpdatedHandler != null)
                {
                    _observedCurrentRoot.LayoutUpdated -= _observedCurrentRootLayoutUpdatedHandler;
                }
            }
        }
        catch
        {
            // ignore
        }
        finally
        {
            _observedCurrentRoot = null;
            _observedCurrentRootLoadedHandler = null;
            _observedCurrentRootLayoutUpdatedHandler = null;
        }
    }
}
