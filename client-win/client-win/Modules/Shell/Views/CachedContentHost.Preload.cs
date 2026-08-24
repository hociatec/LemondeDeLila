using System;
using System.Windows;
using System.Windows.Threading;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    public void Preload(object content)
    {
        if (content == null)
        {
            return;
        }

        if (!TryInvokeWhenReady(() => Preload(content)))
        {
            return;
        }

        try
        {
            if (_entries.TryGetValue(content, out var existing) && existing.IsMaterialized)
            {
                return;
            }

            if (!_queuedPreloads.Add(content))
            {
                return;
            }

            _preloadQueue.Enqueue(content);
            SchedulePreloadPump();
        }
        catch
        {
            // best-effort
        }
    }

    private void SchedulePreloadPump()
    {
        if (_preloadScheduled)
        {
            return;
        }

        _preloadScheduled = true;
        Dispatcher.BeginInvoke(new Action(ProcessPreloadQueue), DispatcherPriority.Background);
    }

    private void ProcessPreloadQueue()
    {
        if (!TryInvokeOnUiThread(ProcessPreloadQueue))
        {
            return;
        }

        try
        {
            if (_preloadQueue.Count == 0)
            {
                _preloadScheduled = false;
                return;
            }

            var content = _preloadQueue.Dequeue();
            _queuedPreloads.Remove(content);
            var entry = GetOrCreateEntry(content, ensureInHostGrid: false);
            if (!entry.IsMaterialized)
            {
                MaterializePresenter(entry.Presenter);
                entry.IsMaterialized = true;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            if (_preloadQueue.Count > 0)
            {
                Dispatcher.BeginInvoke(new Action(ProcessPreloadQueue), DispatcherPriority.Background);
            }
            else
            {
                _preloadScheduled = false;
            }
        }
    }

    private bool TryInvokeWhenReady(Action action)
    {
        if (!TryInvokeOnUiThread(action))
        {
            return false;
        }

        if (IsLoaded)
        {
            return true;
        }

        RoutedEventHandler? handler = null;
        handler = (_, __) =>
        {
            Loaded -= handler;
            try { action(); } catch { /* ignore */ }
        };
        Loaded += handler;
        return false;
    }

    private bool TryInvokeOnUiThread(Action action)
    {
        if (Dispatcher.CheckAccess())
        {
            return true;
        }

        Dispatcher.BeginInvoke(action, DispatcherPriority.Background);
        return false;
    }
}
