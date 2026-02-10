using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
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
    }

    private readonly Dictionary<object, Entry> _entries = new(ReferenceEqualityComparer.Instance);
    private Entry? _current;
    private Entry? _previous;
    private int _transitionId;
    private DateTime _transitionStartedUtc;

    private const int FocusRetryMaxAttempts = 24;
    private static readonly TimeSpan FocusRetryInterval = TimeSpan.FromMilliseconds(125);
    private DispatcherTimer? _retryTimer;
    private int _retryRemaining;

    private const int MaxCacheEntries = 10;

    public CachedContentHost()
    {
        InitializeComponent();
        Loaded += (_, _) => BeginFocusPass();
    }

    public object? CurrentContent
    {
        get => GetValue(CurrentContentProperty);
        set => SetValue(CurrentContentProperty, value);
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
        _transitionId = unchecked(_transitionId + 1);
        _transitionStartedUtc = DateTime.UtcNow;

        _previous = _current;
        _current = newContent == null ? null : GetOrCreateEntry(newContent);

        UpdatePresenterVisibilities();
        EvictIfNeeded();

        BeginFocusPass();
    }

    private Entry GetOrCreateEntry(object content)
    {
        if (_entries.TryGetValue(content, out var existing))
        {
            existing.LastAccessTicks = DateTime.UtcNow.Ticks;
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
            LastAccessTicks = DateTime.UtcNow.Ticks
        };

        _entries.Add(content, entry);
        HostGrid.Children.Add(presenter);
        return entry;
    }

    private static bool IsCacheable(object content)
    {
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

        // When not transitioning, bring current to front.
        if (_previous == null || _current == null)
        {
            if (_current != null)
            {
                Panel.SetZIndex(_current.Presenter, 1);
            }
            if (_previous != null)
            {
                Panel.SetZIndex(_previous.Presenter, 0);
            }
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
            Panel.SetZIndex(_current!.Presenter, 1);
            Panel.SetZIndex(_previous.Presenter, 0);
            _previous.Presenter.IsHitTestVisible = false;
            _previous = null;
            EvictIfNeeded();
        }
    }

    private void BeginFocusPass()
    {
        if (!IsLoaded)
        {
            return;
        }

        _retryRemaining = FocusRetryMaxAttempts;

        // Park focus on a stable element before anything is removed.
        try { FocusParking.ParkIfNeeded(Window.GetWindow(this) ?? Application.Current?.MainWindow); } catch { /* ignore */ }

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

        if ((DateTime.UtcNow - _transitionStartedUtc) < TimeSpan.FromSeconds(3))
        {
            _retryRemaining = Math.Max(_retryRemaining, 1);
            EnsureRetryTimer();
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
        }

        if (FindFirstFocusable(root) is IInputElement target)
        {
            try { (target as UIElement)?.Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(target); } catch { /* ignore */ }
            return IsFocusWithin(root);
        }

        return false;
    }

    private void EvictIfNeeded()
    {
        try
        {
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
                HostGrid.Children.Remove(candidate.Presenter);
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

