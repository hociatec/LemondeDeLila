using System;
using System.Windows;
using System.Windows.Controls;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    private void UpdatePersistentPresenterVisibilities()
    {
        foreach (var entry in _entries.Values)
        {
            var isCurrent = _current != null && ReferenceEquals(entry.Content, _current.Content);
            entry.Presenter.Visibility = isCurrent ? Visibility.Visible : Visibility.Collapsed;
            entry.Presenter.IsHitTestVisible = isCurrent;
            Panel.SetZIndex(entry.Presenter, isCurrent ? 1 : 0);
        }
    }

    private void UpdatePresenterVisibilities()
    {
        foreach (var kv in _entries.Values)
        {
            kv.Presenter.Visibility = Visibility.Collapsed;
            kv.Presenter.IsHitTestVisible = false;
        }

        if (_previous != null)
        {
            _previous.Presenter.Visibility = Visibility.Visible;
            _previous.Presenter.IsHitTestVisible = false;
            Panel.SetZIndex(_previous.Presenter, 1);
        }

        if (_current != null)
        {
            _current.Presenter.Visibility = Visibility.Visible;
            _current.Presenter.IsHitTestVisible = true;
            Panel.SetZIndex(_current.Presenter, 0);
        }

        try
        {
            if (_previous != null && _current != null)
            {
                var previousRoot = CachedContentHostVisualTree.TryGetPresenterRoot(_previous.Presenter);
                var keepPreviousFront =
                    previousRoot != null &&
                    CachedContentHostVisualTree.IsFocusWithin(previousRoot);
                Panel.SetZIndex(_previous.Presenter, keepPreviousFront ? 1 : 0);
                Panel.SetZIndex(_current.Presenter, keepPreviousFront ? 0 : 1);
                return;
            }
        }
        catch
        {
            // ignore
        }

        if (_current != null)
        {
            Panel.SetZIndex(_current.Presenter, 1);
        }

        if (_previous != null)
        {
            Panel.SetZIndex(_previous.Presenter, 0);
        }
    }

    private void FinalizeTransitionIfSafe()
    {
        if (_previous == null)
        {
            return;
        }

        var currentRoot = _current != null
            ? CachedContentHostVisualTree.TryGetPresenterRoot(_current.Presenter)
            : null;
        if (currentRoot != null && CachedContentHostVisualTree.IsFocusWithin(currentRoot))
        {
            Panel.SetZIndex(_current!.Presenter, 1);
            Panel.SetZIndex(_previous.Presenter, 0);
            _previous.Presenter.IsHitTestVisible = false;
            _previous = null;
            EvictIfNeeded();
            return;
        }

        var previousRoot = CachedContentHostVisualTree.TryGetPresenterRoot(_previous.Presenter);
        if (previousRoot == null || !CachedContentHostVisualTree.IsFocusWithin(previousRoot))
        {
            if (_current != null)
            {
                Panel.SetZIndex(_current.Presenter, 1);
            }

            Panel.SetZIndex(_previous.Presenter, 0);
            _previous.Presenter.IsHitTestVisible = false;
            _previous = null;
            EvictIfNeeded();
        }
    }
}
