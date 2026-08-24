using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
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
        public bool IsMaterialized { get; set; }
    }

    private readonly Dictionary<object, Entry> _entries = new(ReferenceEqualityComparer.Instance);
    private Entry? _current;
    private Entry? _previous;
    private readonly ConditionalWeakTable<object, WeakReference<IInputElement>> _lastFocusByContent = new();
    private int _transitionId;
    private DateTime _transitionStartedUtc;

    private IFocusReady? _currentFocusReady;
    private int _currentFocusReadyHookedForTransitionId;
    private FrameworkElement? _observedCurrentRoot;
    private RoutedEventHandler? _observedCurrentRootLoadedHandler;
    private EventHandler? _observedCurrentRootLayoutUpdatedHandler;

    private const int MaxCacheEntries = 10;

    private readonly Queue<object> _preloadQueue = new();
    private readonly HashSet<object> _queuedPreloads = new(ReferenceEqualityComparer.Instance);
    private bool _preloadScheduled;
    private bool _layoutRetryScheduled;

}
