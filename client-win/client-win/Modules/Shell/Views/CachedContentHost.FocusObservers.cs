using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    private void ScheduleTransitionRetry(DispatcherPriority priority)
    {
        if (_layoutRetryScheduled)
        {
            return;
        }

        _layoutRetryScheduled = true;
        var transitionId = _transitionId;
        _ = Dispatcher.BeginInvoke(priority, new Action(() =>
        {
            _layoutRetryScheduled = false;

            if (transitionId != _transitionId || _current == null)
            {
                return;
            }

            if (TryFocusAndMaybeFinalize())
            {
                DetachCurrentRootObservers();
            }
        }));
    }

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
            ScheduleTransitionRetry(DispatcherPriority.Input);
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
            _observedCurrentRootLoadedHandler = (_, _) => ScheduleTransitionRetry(DispatcherPriority.Loaded);
            _observedCurrentRootLayoutUpdatedHandler = (_, _) => ScheduleTransitionRetry(DispatcherPriority.Background);
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
            _layoutRetryScheduled = false;
        }
    }
}
