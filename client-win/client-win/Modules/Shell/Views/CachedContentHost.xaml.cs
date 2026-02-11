using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Core.Diagnostics;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Shell.Views;

/// <summary>
/// Content host that caches DataTemplate-generated views for selected shell-level pages.
/// This avoids destroying/recreating visual trees during navigation, which is a common trigger for NVDA "non disponible".
/// </summary>
public partial class CachedContentHost : UserControl, ICurrentContentRootProvider
{
    public static readonly DependencyProperty CurrentContentProperty =
        DependencyProperty.Register(
            nameof(CurrentContent),
            typeof(object),
            typeof(CachedContentHost),
            new PropertyMetadata(null, OnCurrentContentChanged));

    private sealed class Entry
    {
        public required object Content { get; init; }
        public required ContentPresenter Presenter { get; init; }
        public long LastAccessTicks { get; set; }
        public bool Cacheable { get; init; }
        public bool IsInHostGrid { get; set; }
    }

    private readonly Dictionary<object, Entry> _entries = new(ReferenceEqualityComparer.Instance);
    private Entry? _current;
    private Entry? _previous;
    private readonly ConditionalWeakTable<object, WeakReference<IInputElement>> _lastFocusByContent = new();
    private int _transitionId;
    private DateTime _transitionStartedUtc;

    // Navigation focus retries are used to wait for async-populated views to become focusable.
    // This used to allow up to ~3s of "previous view still alive" time; keep it short to reduce perceived latency.
    private const int FocusRetryMaxAttempts = 16;
    private static readonly TimeSpan FocusRetryInterval = TimeSpan.FromMilliseconds(80);
    private DispatcherTimer? _retryTimer;
    private int _retryRemaining;
    private IFocusReady? _currentFocusReady;
    private int _currentFocusReadyHookedForTransitionId;

    private const int MaxCacheEntries = 10;

    private readonly Queue<object> _preloadQueue = new();
    private bool _preloadScheduled;

    public CachedContentHost()
    {
        InitializeComponent();
        Loaded += (_, _) => BeginFocusPass();

        try
        {
            // Memorize the last focused element per cached content.
            // This improves "Escape -> back" UX: when returning to a previous view instance,
            // restore focus exactly where the user left off (instead of forcing initial focus).
            AddHandler(Keyboard.GotKeyboardFocusEvent, new KeyboardFocusChangedEventHandler(OnGotKeyboardFocus), handledEventsToo: true);
        }
        catch
        {
            // best-effort
        }
    }

    public object? CurrentContent
    {
        get => GetValue(CurrentContentProperty);
        set => SetValue(CurrentContentProperty, value);
    }

    /// <summary>
    /// Pre-creates the presenter and materializes the view template for the given content without navigating to it.
    /// This shifts the first-time WPF DataTemplate + layout cost to an idle/background moment.
    /// </summary>
    public void Preload(object content)
    {
        if (content == null)
        {
            return;
        }

        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(new Action(() => Preload(content)), DispatcherPriority.Background);
            return;
        }

        if (!IsLoaded)
        {
            RoutedEventHandler? handler = null;
            handler = (_, __) =>
            {
                Loaded -= handler;
                try { Preload(content); } catch { /* ignore */ }
            };
            Loaded += handler;
            return;
        }

        try
        {
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
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(new Action(ProcessPreloadQueue), DispatcherPriority.Background);
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
            var entry = GetOrCreateEntry(content, ensureInHostGrid: false);
            MaterializePresenter(entry.Presenter);
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

    public DependencyObject? TryGetCurrentContentRoot()
        => _current != null ? TryGetPresenterRoot(_current.Presenter) : null;

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
        _currentFocusReadyHookedForTransitionId = 0;

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
            IsInHostGrid = false
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

        try
        {
            HostGrid.Children.Add(entry.Presenter);
            entry.IsInHostGrid = true;
        }
        catch
        {
            // best-effort
        }
    }

    private void MaterializePresenter(ContentPresenter presenter)
    {
        try
        {
            // The presenter is normally Collapsed until navigated to. Collapsed content is not measured/arranged,
            // so we temporarily make it non-rendered but measurable to force template/materialization.
            var oldVisibility = presenter.Visibility;
            var oldOpacity = presenter.Opacity;
            var oldHitTest = presenter.IsHitTestVisible;
            var oldZ = Panel.GetZIndex(presenter);

            presenter.IsHitTestVisible = false;
            presenter.Focusable = false;
            presenter.Opacity = 0;
            presenter.Visibility = Visibility.Hidden;
            Panel.SetZIndex(presenter, -1000);

            presenter.ApplyTemplate();

            var w = ActualWidth;
            var h = ActualHeight;
            if (double.IsNaN(w) || w <= 0) w = 1280;
            if (double.IsNaN(h) || h <= 0) h = 720;

            var size = new Size(w, h);
            presenter.Measure(size);
            presenter.Arrange(new Rect(new Point(0, 0), size));
            presenter.UpdateLayout();

            presenter.Visibility = oldVisibility;
            presenter.Opacity = oldOpacity;
            presenter.IsHitTestVisible = oldHitTest;
            Panel.SetZIndex(presenter, oldZ);
        }
        catch
        {
            // best-effort
        }
    }

    private static bool IsCacheable(object content)
    {
        if (content is IShellContentCachePolicy policy)
        {
            return policy.IsCacheable;
        }

        // Cache only "shell pages" that are frequently revisited and known to be single-instance per navigation.
        // Ephemeral pages (catalog/stats/leaderboard/join game/game room) are intentionally not cached.
        var t = content.GetType();
        var name = t.FullName ?? t.Name;
        return name.Contains("Modules.Home.ViewModels.HomeViewModel", StringComparison.Ordinal) ||
               name.Contains("Modules.MainMenu.ViewModels.MainMenuViewModel", StringComparison.Ordinal) ||
               name.Contains("Modules.Social.ViewModels.SocialViewModel", StringComparison.Ordinal) ||
               name.Contains("Modules.Presence.ViewModels.PresenceViewModel", StringComparison.Ordinal) ||
               name.Contains("Modules.Settings.ViewModels.OptionsViewModel", StringComparison.Ordinal) ||
               name.Contains("Modules.About.ViewModels.AboutViewModel", StringComparison.Ordinal) ||
               name.Contains("Modules.Admin.ViewModels.AdminViewModel", StringComparison.Ordinal) ||
               name.Contains("Modules.Notifications.ViewModels.NotificationsViewModel", StringComparison.Ordinal) ||
               name.Contains("Modules.Messaging.ViewModels.MessagingViewModel", StringComparison.Ordinal);
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

        // Z-order policy (NVDA + UX):
        // - During transition, keep the previous view on top ONLY if keyboard focus is still within it.
        //   Otherwise, show the new view immediately to avoid a perceived "latency" (up to 3s timeout).
        // - When not transitioning, always keep current on top.
        try
        {
            if (_previous != null && _current != null)
            {
                var keepPreviousFront = false;
                var previousRoot = TryGetPresenterRoot(_previous.Presenter);
                keepPreviousFront = previousRoot != null && IsFocusWithin(previousRoot);
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

        var currentRoot = _current != null ? TryGetPresenterRoot(_current.Presenter) : null;
        if (currentRoot != null && IsFocusWithin(currentRoot))
        {
            Panel.SetZIndex(_current!.Presenter, 1);
            Panel.SetZIndex(_previous.Presenter, 0);
            _previous.Presenter.IsHitTestVisible = false;
            _previous = null;
            EvictIfNeeded();
            return;
        }

        // If focus is not in the previous view anymore, we can drop it.
        var previousRoot = TryGetPresenterRoot(_previous.Presenter);
        if (previousRoot == null || !IsFocusWithin(previousRoot))
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

    private void BeginFocusPass()
    {
        using var _ = PerfTrace.Measure("nav.focusPass");
        if (!IsLoaded)
        {
            return;
        }

        _retryRemaining = FocusRetryMaxAttempts;

        // Park focus on a stable element before anything is removed.
        // IMPORTANT (NVDA): when a "previous" view remains temporarily visible (focus-safety transition),
        // we must move keyboard focus off the old view, otherwise it can keep receiving input (Enter/Tab/etc)
        // and the transition may never finalize.
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

        // After parking focus, re-evaluate z-order immediately.
        // This avoids showing the previous view "on top" for a few seconds on slower machines,
        // where focus can take longer to land in the new view.
        try { UpdatePresenterVisibilities(); } catch { /* ignore */ }

        // Fast path: if the new view is already loaded/focusable (cached views),
        // finalize immediately without waiting for dispatcher/timer ticks.
        if (TryFocusAndMaybeFinalize())
        {
            try { _retryTimer?.Stop(); } catch { /* ignore */ }
            return;
        }

        Dispatcher.BeginInvoke((Action)(() => TryFocusAndMaybeFinalize()), DispatcherPriority.Loaded);
        Dispatcher.BeginInvoke((Action)(() => TryFocusAndMaybeFinalize()), DispatcherPriority.ApplicationIdle);
        EnsureRetryTimer();
    }

    private void EnsureRetryTimer()
    {
        if (_retryTimer == null)
        {
            _retryTimer = new DispatcherTimer(DispatcherPriority.ApplicationIdle, Dispatcher)
            {
                Interval = FocusRetryInterval
            };
            _retryTimer.Tick += (_, _) => Retry();
        }

        _retryTimer.Interval = FocusRetryInterval;
        _retryTimer.Start();
    }

    private void Retry()
    {
        if (_retryRemaining <= 0)
        {
            try { _retryTimer?.Stop(); } catch { /* ignore */ }
            TryForceFinalizeAfterTimeout();
            return;
        }

        _retryRemaining--;
        if (TryFocusAndMaybeFinalize())
        {
            try { _retryTimer?.Stop(); } catch { /* ignore */ }
        }
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
                return true;
            }

            FinalizeTransitionIfSafe();
            return false;
        }
        catch
        {
            return false;
        }
    }

    private void TryForceFinalizeAfterTimeout()
    {
        if (_previous == null)
        {
            return;
        }

        try
        {
            var previousRoot = TryGetPresenterRoot(_previous.Presenter);
            if (previousRoot != null && IsFocusWithin(previousRoot))
            {
                try { FocusParking.ForcePark(Window.GetWindow(this) ?? Application.Current?.MainWindow); } catch { /* ignore */ }
            }
        }
        catch
        {
            // ignore
        }
        finally
        {
            if (_current != null)
            {
                Panel.SetZIndex(_current.Presenter, 1);
            }
            _previous.Presenter.IsHitTestVisible = false;
            _previous = null;
            EvictIfNeeded();
        }
    }

    private bool TryFocusCurrent()
    {
        using var _ = PerfTrace.Measure("nav.tryFocusCurrent");
        if (_current == null)
        {
            return false;
        }

        var root = TryGetPresenterRoot(_current.Presenter);
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

        // If we have a remembered focus target for this content, restore it first.
        // This is especially important for "back" navigation, where the user expects to land
        // on the previous selected item / input.
        if (!IsFocusWithin(root) && TryRestoreLastFocus(_current.Content, root))
        {
            return true;
        }

        if (root is IInitialFocusTarget focusTarget)
        {
            if (!IsFocusWithin(root))
            {
                try { focusTarget.RequestInitialFocus(); } catch { /* ignore */ }
            }
            if (IsFocusWithin(root))
            {
                return true;
            }

            // IMPORTANT (perf): avoid scanning the whole visual tree when a view provides a focus target.
            // On slower machines (or during heavy view creation), repeated deep scans can freeze the UI.
            // Let the next retry tick attempt RequestInitialFocus again once the view is fully loaded.
            return false;
        }

        if (FindFirstFocusable(root) is IInputElement target)
        {
            try { (target as UIElement)?.Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(target); } catch { /* ignore */ }
            return IsFocusWithin(root);
        }

        return false;
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
            var transitionId = _transitionId;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                if (transitionId != _transitionId)
                {
                    return;
                }

                if (TryFocusAndMaybeFinalize())
                {
                    try { _retryTimer?.Stop(); } catch { /* ignore */ }
                }
            }));
        }
        catch
        {
            // ignore
        }
    }

    private void OnGotKeyboardFocus(object? sender, KeyboardFocusChangedEventArgs e)
    {
        try
        {
            if (_current == null)
            {
                return;
            }

            if (e.NewFocus is not DependencyObject focused)
            {
                return;
            }

            var root = TryGetPresenterRoot(_current.Presenter);
            if (root == null)
            {
                return;
            }

            if (!IsDescendantOrSelf(focused, root))
            {
                return;
            }

            if (e.NewFocus is not IInputElement input)
            {
                return;
            }

            // Avoid storing focus on the host itself/sentinels.
            if (focused is FrameworkElement fe)
            {
                if (string.Equals(fe.Name, "RootHost", StringComparison.Ordinal) ||
                    string.Equals(fe.Name, "FocusSentinel", StringComparison.Ordinal))
                {
                    return;
                }
            }

            _lastFocusByContent.Remove(_current.Content);
            _lastFocusByContent.Add(_current.Content, new WeakReference<IInputElement>(input));
        }
        catch
        {
            // best-effort
        }
    }

    private bool TryRestoreLastFocus(object content, DependencyObject expectedRoot)
    {
        try
        {
            if (!_lastFocusByContent.TryGetValue(content, out var weak) || weak == null)
            {
                return false;
            }

            if (!weak.TryGetTarget(out var target) || target == null)
            {
                return false;
            }

            if (target is not DependencyObject dep)
            {
                return false;
            }

            if (PresentationSource.FromDependencyObject(dep) == null)
            {
                return false;
            }

            if (!IsDescendantOrSelf(dep, expectedRoot))
            {
                return false;
            }

            if (target is UIElement ui)
            {
                if (!ui.IsVisible || !ui.IsEnabled)
                {
                    return false;
                }
                try { ui.Focus(); } catch { /* ignore */ }
            }

            try { Keyboard.Focus(target); } catch { /* ignore */ }
            return IsFocusWithin(expectedRoot);
        }
        catch
        {
            return false;
        }
    }

    private static bool IsDescendantOrSelf(DependencyObject child, DependencyObject root)
    {
        for (DependencyObject? current = child; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, root))
            {
                return true;
            }
        }
        return false;
    }

    private void EvictIfNeeded()
    {
        try
        {
            EvictNonCacheables();

            // Do not evict while an entry is still the previous visible presenter.
            var count = _entries.Count(e => e.Value.Cacheable);
            if (count <= MaxCacheEntries)
            {
                return;
            }

            var protectedContents = new HashSet<object>(ReferenceEqualityComparer.Instance);
            if (_current != null) protectedContents.Add(_current.Content);
            if (_previous != null) protectedContents.Add(_previous.Content);

            foreach (var candidate in _entries.Values
                         .Where(e => e.Cacheable && !protectedContents.Contains(e.Content))
                         .OrderBy(e => e.LastAccessTicks)
                         .Take(Math.Max(0, count - MaxCacheEntries))
                         .ToArray())
            {
                if (candidate.IsInHostGrid)
                {
                    HostGrid.Children.Remove(candidate.Presenter);
                    candidate.IsInHostGrid = false;
                }
                _entries.Remove(candidate.Content);
            }
        }
        catch
        {
            // best-effort
        }
    }

    private void EvictNonCacheables()
    {
        try
        {
            // Non-cacheable pages are intentionally not kept beyond the current/previous transition window.
            // Keeping them would accumulate hidden visual trees and degrade performance over time.
            var protectedContents = new HashSet<object>(ReferenceEqualityComparer.Instance);
            if (_current != null) protectedContents.Add(_current.Content);
            if (_previous != null) protectedContents.Add(_previous.Content);

            foreach (var candidate in _entries.Values
                         .Where(e => !e.Cacheable && !protectedContents.Contains(e.Content))
                         .ToArray())
            {
                if (candidate.IsInHostGrid)
                {
                    HostGrid.Children.Remove(candidate.Presenter);
                    candidate.IsInHostGrid = false;
                }
                _entries.Remove(candidate.Content);
            }
        }
        catch
        {
            // best-effort
        }
    }

    private static DependencyObject? TryGetPresenterRoot(ContentPresenter presenter)
    {
        try
        {
            var count = VisualTreeHelper.GetChildrenCount(presenter);
            if (count <= 0)
            {
                return null;
            }
            return VisualTreeHelper.GetChild(presenter, 0);
        }
        catch
        {
            return null;
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

    private sealed class ReferenceEqualityComparer : IEqualityComparer<object>
    {
        public static readonly ReferenceEqualityComparer Instance = new();
        public new bool Equals(object? x, object? y) => ReferenceEquals(x, y);
        public int GetHashCode(object obj) => RuntimeHelpers.GetHashCode(obj);
    }
}

