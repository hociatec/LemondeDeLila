using System;
using System.Windows;
using System.Windows.Controls;
using client_win.Core.Diagnostics;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    private static void OnCurrentContentChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var host = (CachedContentHost)d;
        host.OnCurrentContentChanged(oldContent: e.OldValue, newContent: e.NewValue);
    }

    private void OnCurrentContentChanged(object? oldContent, object? newContent)
    {
        using var _ = PerfTrace.Measure($"nav.swap {(newContent?.GetType().Name ?? "<null>")}");

        _transitionId = unchecked(_transitionId + 1);
        _transitionStartedUtc = DateTime.UtcNow;

        if (_currentFocusReady != null)
        {
            try { _currentFocusReady.FocusReadyChanged -= OnCurrentFocusReadyChanged; } catch { /* ignore */ }
            _currentFocusReady = null;
        }
        DetachCurrentRootObservers();
        _currentFocusReadyHookedForTransitionId = 0;

        if (newContent != null && IsPersistentShellPage(newContent))
        {
            try
            {
                if (_current != null)
                {
                    var oldRoot = CachedContentHostVisualTree.TryGetPresenterRoot(_current.Presenter);
                    if (oldRoot != null && CachedContentHostVisualTree.IsFocusWithin(oldRoot))
                    {
                        FocusParking.ForcePark(Window.GetWindow(this) ?? Application.Current?.MainWindow);
                    }
                }
            }
            catch
            {
                // best-effort
            }

            _previous = null;
            _current = GetOrCreateEntry(newContent, ensureInHostGrid: true);

            UpdatePersistentPresenterVisibilities();
            EvictIfNeeded();

            BeginFocusPass();
            return;
        }

        _previous = _current;
        _current = newContent == null ? null : GetOrCreateEntry(newContent, ensureInHostGrid: true);

        UpdatePresenterVisibilities();
        EvictIfNeeded();

        BeginFocusPass();
    }

    private Entry GetOrCreateEntry(object content, bool ensureInHostGrid)
    {
        if (_entries.TryGetValue(content, out var existing))
        {
            existing.LastAccessTicks = DateTime.UtcNow.Ticks;
            if (ensureInHostGrid)
            {
                EnsureEntryInHostGrid(existing);
            }
            return existing;
        }

        var presenter = new ContentPresenter
        {
            Content = content,
            Visibility = Visibility.Collapsed,
            IsHitTestVisible = false,
            Focusable = false
        };

        var cacheable = IsCacheable(content);
        var entry = new Entry
        {
            Content = content,
            Presenter = presenter,
            Cacheable = cacheable,
            LastAccessTicks = DateTime.UtcNow.Ticks,
            IsInHostGrid = false,
            IsMaterialized = false
        };

        _entries.Add(content, entry);
        if (ensureInHostGrid)
        {
            EnsureEntryInHostGrid(entry);
        }

        return entry;
    }

    private void EnsureEntryInHostGrid(Entry entry)
    {
        if (entry.IsInHostGrid)
        {
            return;
        }

        HostGrid.Children.Add(entry.Presenter);
        entry.IsInHostGrid = true;
    }

    private void MaterializePresenter(ContentPresenter presenter)
    {
        try
        {
            presenter.ApplyTemplate();
            presenter.UpdateLayout();

            var size = new Size(
                double.IsNaN(ActualWidth) || ActualWidth <= 0 ? 1 : ActualWidth,
                double.IsNaN(ActualHeight) || ActualHeight <= 0 ? 1 : ActualHeight);
            presenter.Measure(size);
            presenter.Arrange(new Rect(new Point(0, 0), size));
            presenter.UpdateLayout();
        }
        catch
        {
            // best-effort
        }
    }
}
