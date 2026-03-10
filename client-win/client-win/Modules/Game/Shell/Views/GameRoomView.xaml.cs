using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Shell.Models;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView : UserControl, IInitialFocusTarget, IGameFocusHost
{
    private static readonly TimeSpan RapidTabRecoveryWindow = TimeSpan.FromMilliseconds(300);
    private GameRoomViewModel? _vm;
    private IDisposable? _focusHostLease;
    private IScreenReaderAnnouncer? _screenReader;
    private GameRoomFocusPolicy? _focusPolicy;
    private Action? _historyFocusedUpdateHandler;
    private KeyEventHandler? _rootTabHandler;
    private DateTime _lastTabCycleAtUtc;
    private TabTargetKind? _lastTabCycleTargetKind;

    public GameRoomView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
    }

    private void OnLoaded(object? sender, RoutedEventArgs e)
    {
        EnsureFocusPolicy();
        HookRootTabCapture(attach: true);
        HookGameZoneHostEvents(attach: true);
        HookFocusRequests(DataContext as GameRoomViewModel);
        HookHistoryUpdates();
        RequestFocusGameZoneInternal(GameFocusReason.InitialLoad);
        QueueInitialFocus();
    }

    private void OnUnloaded(object? sender, RoutedEventArgs e)
    {
        HookGameZoneHostEvents(attach: false);
        HookFocusRequests(null);
        UnhookHistoryUpdates();
        HookRootTabCapture(attach: false);
        _focusPolicy?.Detach();
    }

    private void OnDataContextChanged(object? sender, DependencyPropertyChangedEventArgs e)
    {
        HookFocusRequests(e.NewValue as GameRoomViewModel);
    }

    private void EnsureFocusPolicy()
    {
        if (_focusPolicy == null)
        {
            _focusPolicy = new GameRoomFocusPolicy(this);
        }

        _focusPolicy.Attach();

        if (GameZoneHost is GameZoneHostView zone)
        {
            zone.AllowAnchorAutoFocus = _focusPolicy.AnchorAutoFocusEvaluator;
        }
    }

    private void HookGameZoneHostEvents(bool attach)
    {
        if (GameZoneHost is not GameZoneHostView zone)
        {
            return;
        }

        zone.StartRequested -= OnGameZoneStartRequested;
        if (attach)
        {
            zone.StartRequested += OnGameZoneStartRequested;
        }
    }

    private void OnGameZoneStartRequested(object? sender, EventArgs e)
    {
        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        if (!vm.GameZone.StartCommand.CanExecute(null))
        {
            return;
        }

        vm.GameZone.StartCommand.Execute(null);
    }

    private void HookFocusRequests(GameRoomViewModel? vm)
    {
        _focusHostLease?.Dispose();
        _focusHostLease = null;
        if (_vm != null)
        {
            _vm.ServerFocusIntentRequested -= OnServerFocusIntent;
        }

        _vm = vm;
        if (_vm == null)
        {
            _screenReader = null;
            HistoryHost?.SetScreenReader(null);
            return;
        }

        _screenReader = _vm.ScreenReader;
        HistoryHost?.SetScreenReader(_screenReader);
        _focusHostLease = _vm.GameZone.FocusCoordinator.AttachHost(this);
        _vm.ServerFocusIntentRequested += OnServerFocusIntent;
    }

    private void OnServerFocusIntent(ServerFocusIntent intent)
    {
        if (intent == null)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => ApplyServerFocusIntent(intent)));
    }

    private void ApplyServerFocusIntent(ServerFocusIntent intent)
    {
        if (intent == null)
        {
            return;
        }

        switch (intent.Region)
        {
            case ServerFocusRegion.GameZone:
                RequestFocusGameZoneInternal(GameFocusReason.Default);
                break;
            case ServerFocusRegion.History:
                FocusHistory();
                break;
            case ServerFocusRegion.Chat:
                FocusChatInput();
                break;
        }
    }

    private void HookHistoryUpdates()
    {
        if (HistoryHost == null || _historyFocusedUpdateHandler != null)
        {
            return;
        }

        _historyFocusedUpdateHandler = () => _focusPolicy?.NotifyHistoryUpdated();
        HistoryHost.HistoryUpdatedWhileFocused += _historyFocusedUpdateHandler;
    }

    private void UnhookHistoryUpdates()
    {
        if (HistoryHost == null || _historyFocusedUpdateHandler == null)
        {
            return;
        }

        HistoryHost.HistoryUpdatedWhileFocused -= _historyFocusedUpdateHandler;
        _historyFocusedUpdateHandler = null;
    }

    internal void FocusHistory()
    {
        _ = TryFocusHistoryInternal();
    }

    internal void FocusChatInput()
    {
        _ = TryFocusChatInternal();
    }

    private bool TryFocusHistoryInternal()
    {
        _vm?.GameZone.FocusCoordinator.CancelPendingRequests();
        CancelPendingGamePlayFocusRecovery();

        if (HistoryHost == null || !HistoryHost.IsVisible || !HistoryHost.IsEnabled)
        {
            return false;
        }

        var target = HistoryHost.FocusTarget ?? (HistoryHost as FrameworkElement);
        if (target == null || !target.IsVisible || !target.IsEnabled)
        {
            return false;
        }

        bool ok = false;
        void Attempt()
        {
            ok = target.Focus();
            Keyboard.Focus(target);
            ok = ok || ReferenceEquals(Keyboard.FocusedElement, target) ||
                 IsFocusWithinElement(target, Keyboard.FocusedElement as DependencyObject) ||
                 HistoryHost.IsKeyboardFocusWithin;
        }

        if (_focusPolicy != null)
        {
            _focusPolicy.RunInternal(Attempt);
        }
        else
        {
            Attempt();
        }

        HistoryHost.FocusToBottom();
        return ok;
    }

    private bool TryFocusChatInternal()
    {
        _vm?.GameZone.FocusCoordinator.CancelPendingRequests();
        CancelPendingGamePlayFocusRecovery();

        if (ChatInput == null || ChatHost?.Visibility != Visibility.Visible || !ChatInput.IsEnabled || !ChatInput.IsVisible)
        {
            return false;
        }

        bool ok = false;
        void Attempt()
        {
            ok = ChatInput.Focus();
            Keyboard.Focus(ChatInput);
            ok = ok || ChatInput.IsKeyboardFocusWithin || ReferenceEquals(Keyboard.FocusedElement, ChatInput);
        }

        if (_focusPolicy != null)
        {
            _focusPolicy.RunInternal(Attempt);
        }
        else
        {
            Attempt();
        }

        return ok;
    }

    private void CancelPendingGamePlayFocusRecovery()
    {
        if (GameZoneHost == null)
        {
            return;
        }

        foreach (var playView in FindDescendants<GamePlayView>(GameZoneHost))
        {
            playView.CancelPendingFocusRecovery();
        }
    }

    public void RequestFocusGameZone(GameFocusReason reason = GameFocusReason.Default) => RequestFocusGameZoneInternal(reason);

    internal void RequestFocusGameZoneInternal(GameFocusReason reason)
    {
        if (_focusPolicy != null && !_focusPolicy.ShouldAllowGameZoneRequest(reason))
        {
            return;
        }

        if (GameZoneHost is GameZoneHostView zone)
        {
            if (_focusPolicy != null)
            {
                _focusPolicy.RunInternal(() => zone.FocusGameZone(reason));
            }
            else
            {
                zone.FocusGameZone(reason);
            }
        }
    }

    public GameFocusAttemptResult FocusGameZone(GameFocusReason reason)
    {
        if (GameZoneHost is not GameZoneHostView zone)
        {
            return GameFocusAttemptResult.None;
        }

        if (_focusPolicy != null && !_focusPolicy.ShouldAllowGameZoneRequest(reason))
        {
            return GameFocusAttemptResult.None;
        }

        if (_focusPolicy != null)
        {
            return _focusPolicy.RunInternal(() => zone.FocusGameZone(reason));
        }

        return zone.FocusGameZone(reason);
    }

    public void ActivateWindow()
    {
        try
        {
            (Window.GetWindow(this) ?? Application.Current?.MainWindow)?.Activate();
        }
        catch
        {
        }
    }

    public void RequestInitialFocus() => RequestFocusGameZoneInternal(GameFocusReason.InitialLoad);

    private void QueueInitialFocus()
    {
        // Double-pass: ensure focus lands in the game zone once layout/activation settles.
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            RequestFocusGameZoneInternal(GameFocusReason.InitialLoad)));
        _ = Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
            RequestFocusGameZoneInternal(GameFocusReason.InitialLoad)));
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        _focusPolicy?.NotifyUserKeyDown(key);

        if (key is Key.Enter or Key.Return)
        {
            if (DataContext is GameRoomViewModel vm &&
                vm.GameZone is { IsStarted: false } &&
                vm.GameZone.StartCommand.CanExecute(null))
            {
                var focused = Keyboard.FocusedElement as DependencyObject ?? e.OriginalSource as DependencyObject;

                // Never override chat Enter (send message).
                if (ChatInput != null &&
                    (ChatInput.IsKeyboardFocusWithin ||
                     ReferenceEquals(Keyboard.FocusedElement, ChatInput) ||
                     (focused != null && IsFocusWithinElement(ChatInput, focused))))
                {
                    return;
                }

                // When an inline prompt overlay is visible, Enter belongs to the prompt.
                if (HasVisibleInlinePrompt())
                {
                    return;
                }

                e.Handled = true;
                vm.GameZone.StartCommand.Execute(null);
                return;
            }
        }

        if (key == Key.Tab)
        {
            var isShift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
            if (TryHandleTabCycle(isShift, e.OriginalSource as DependencyObject))
            {
                e.Handled = true;
                return;
            }
        }
    }

    private void OnChatInputPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var key = e.Key == Key.System ? e.SystemKey : e.Key;

        if (key is not (Key.Enter or Key.Return))
        {
            return;
        }

        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        if (vm.Chat.SendCommand.CanExecute(null))
        {
            e.Handled = true;
            vm.Chat.SendCommand.Execute(null);
        }
    }

    private void HookRootTabCapture(bool attach)
    {
        if (Root == null)
        {
            return;
        }

        if (_rootTabHandler != null)
        {
            Root.RemoveHandler(Keyboard.PreviewKeyDownEvent, _rootTabHandler);
            _rootTabHandler = null;
        }

        if (!attach)
        {
            return;
        }

        // Ensure TAB / MAJ+TAB cycling works even if another handler (ex: shortcut behavior)
        // marks the event as handled before it reaches the XAML PreviewKeyDown hook.
        _rootTabHandler = OnPreviewKeyDown;
        Root.AddHandler(Keyboard.PreviewKeyDownEvent, _rootTabHandler, handledEventsToo: true);
    }

    private bool TryHandleTabCycle(bool isShift)
    {
        return TryHandleTabCycle(isShift, focusedHint: null);
    }

    private bool TryHandleTabCycle(bool isShift, DependencyObject? focusedHint)
    {
        var targets = GetTabCycleTargets();
        if (targets.Count == 0)
        {
            return false;
        }

        // If only the game zone is focusable/visible (chat/history hidden or not focusable yet),
        // still handle Tab/Shift+Tab as a "recover focus into game zone" action.
        // This is important because other behaviors can mark Tab as handled before it reaches here:
        // in that case, returning false would leave the user stuck with no default tab navigation.
        if (targets.Count == 1)
        {
            return FocusTabTarget(targets[0]);
        }

        var focused = Keyboard.FocusedElement as DependencyObject
                      ?? focusedHint
                      ?? FocusManager.GetFocusedElement(this) as DependencyObject;
        if (focused == null)
        {
            // Fast Tab/Shift+Tab can temporarily null out Keyboard.FocusedElement during focus transitions
            // (collapsed targets, async focus recovery, etc.). Recover to a stable circular target.
            if (TryRecoverRapidTabTarget(targets, isShift, out var recoveredIndex))
            {
                var recoveredNextIndex = isShift
                    ? (recoveredIndex - 1 + targets.Count) % targets.Count
                    : (recoveredIndex + 1) % targets.Count;
                if (FocusTabTarget(targets[recoveredNextIndex]))
                {
                    RememberTabCycleTarget(targets[recoveredNextIndex]);
                    return true;
                }
            }

            var fallback = isShift ? targets[^1] : targets[0];
            if (FocusTabTarget(fallback))
            {
                RememberTabCycleTarget(fallback);
                return true;
            }

            return false;
        }

        // When an inline prompt overlay is visible, TAB belongs to the prompt (do not cycle out of the game).
        if (HasVisibleInlinePrompt())
        {
            return false;
        }

        var index = GetTargetIndexForFocus(targets, focused);
        if (index < 0)
        {
            if (TryRecoverRapidTabTarget(targets, isShift, out var recoveredIndex))
            {
                index = recoveredIndex;
            }
        }

        if (index < 0)
        {
            if (!IsFocusWithinElement(this, focused))
            {
                return false;
            }

            // If focus is inside the view but not on a known target (ex: header title),
            // start the cycle from the ends so Tab goes to game zone and Shift+Tab to history.
            index = isShift ? 0 : targets.Count - 1;
        }

        var nextIndex = isShift ? (index - 1 + targets.Count) % targets.Count : (index + 1) % targets.Count;

        // Skip any temporarily non-focusable targets (rapid Tab while UI updates) to keep the cycle stable.
        for (var attempts = 0; attempts < targets.Count; attempts++)
        {
            if (FocusTabTarget(targets[nextIndex]))
            {
                RememberTabCycleTarget(targets[nextIndex]);
                return true;
            }

            nextIndex = isShift
                ? (nextIndex - 1 + targets.Count) % targets.Count
                : (nextIndex + 1) % targets.Count;
        }

        return false;
    }

    private bool TryRecoverRapidTabTarget(IReadOnlyList<TabTarget> targets, bool isShift, out int index)
    {
        index = -1;
        if (!_lastTabCycleTargetKind.HasValue)
        {
            return false;
        }

        if (DateTime.UtcNow - _lastTabCycleAtUtc > RapidTabRecoveryWindow)
        {
            return false;
        }

        for (var i = 0; i < targets.Count; i++)
        {
            if (targets[i].Kind == _lastTabCycleTargetKind.Value)
            {
                index = i;
                return true;
            }
        }

        index = isShift ? 0 : targets.Count - 1;
        return true;
    }

    private void RememberTabCycleTarget(TabTarget target)
    {
        _lastTabCycleAtUtc = DateTime.UtcNow;
        _lastTabCycleTargetKind = target.Kind;
    }

    private bool HasVisibleInlinePrompt()
    {
        if (GameZoneHost == null)
        {
            return false;
        }

        foreach (var playView in FindDescendants<GamePlayView>(GameZoneHost))
        {
            if (playView.FindName("InlinePromptOverlay") is UIElement overlay &&
                overlay.Visibility == Visibility.Visible)
            {
                return true;
            }
        }

        return false;
    }

    private static IEnumerable<T> FindDescendants<T>(DependencyObject root)
        where T : DependencyObject
    {
        if (root == null)
        {
            yield break;
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child == null)
            {
                continue;
            }

            if (child is T typed)
            {
                yield return typed;
            }

            foreach (var descendant in FindDescendants<T>(child))
            {
                yield return descendant;
            }
        }
    }

    private List<TabTarget> GetTabCycleTargets()
    {
        var targets = new List<TabTarget>(4);

        if (GameZoneHost != null && GameZoneHost.IsVisible)
        {
            targets.Add(TabTarget.GameZone(GameZoneHost));
        }

        if (ChatHost?.Visibility == Visibility.Visible && ChatInput != null && IsFocusableTarget(ChatInput))
        {
            targets.Add(TabTarget.Chat(ChatInput));
        }

        var historyTarget = HistoryHost?.FocusTarget ?? (HistoryHost as FrameworkElement);
        // For circular navigation we can focus history programmatically even if the underlying
        // target isn't a WPF TabStop yet (virtualization/late template). We'll verify success on focus.
        if (historyTarget != null && HistoryHost != null && HistoryHost.IsVisible && HistoryHost.IsEnabled)
        {
            targets.Add(TabTarget.History(historyTarget));
        }

        return targets;
    }

    private static bool IsFocusableTarget(FrameworkElement? element)
    {
        if (element == null)
        {
            return false;
        }

        if (!element.IsVisible || !element.IsEnabled)
        {
            return false;
        }

        return element.Focusable || KeyboardNavigation.GetIsTabStop(element);
    }

    private int GetTargetIndexForFocus(IReadOnlyList<TabTarget> targets, DependencyObject focused)
    {
        for (var i = 0; i < targets.Count; i++)
        {
            var root = targets[i].FocusRoot;
            if (root != null && IsFocusWithinElement(root, focused))
            {
                return i;
            }
        }

        var historyIndex = TryFindHistoryIndex(targets);
        if (historyIndex >= 0 && HistoryHost?.IsKeyboardFocusWithin == true)
        {
            return historyIndex;
        }

        var gameZoneIndex = TryFindGameZoneIndex(targets);
        if (gameZoneIndex >= 0 && IsGameZoneContext(focused))
        {
            return gameZoneIndex;
        }

        return -1;
    }

    private bool FocusTabTarget(TabTarget target)
    {
        if (target.Kind == TabTargetKind.GameZone)
        {
            return FocusGameZone(GameFocusReason.TabCycle) != GameFocusAttemptResult.None;
        }

        if (target.Kind == TabTargetKind.Chat)
        {
            return TryFocusChatInternal();
        }

        if (target.Kind == TabTargetKind.History)
        {
            return TryFocusHistoryInternal();
        }

        if (!IsFocusableTarget(target.Element))
        {
            return false;
        }

        var element = target.Element!;
        if (_focusPolicy != null)
        {
            _focusPolicy.RunInternal(() =>
            {
                element.Focus();
                Keyboard.Focus(element);
            });
        }
        else
        {
            element.Focus();
            Keyboard.Focus(element);
        }

        return true;
    }

    private sealed class TabTarget
    {
        public TabTargetKind Kind { get; }
        public FrameworkElement? Element { get; }
        public FrameworkElement? FocusRoot { get; }

        private TabTarget(TabTargetKind kind, FrameworkElement? element, FrameworkElement? focusRoot)
        {
            Kind = kind;
            Element = element;
            FocusRoot = focusRoot;
        }

        public static TabTarget Name(FrameworkElement element) => new(TabTargetKind.Name, element, element);
        public static TabTarget Chat(FrameworkElement element) => new(TabTargetKind.Chat, element, element);
        public static TabTarget History(FrameworkElement element) => new(TabTargetKind.History, element, element);
        public static TabTarget GameZone(FrameworkElement root) => new(TabTargetKind.GameZone, null, root);
    }

    private enum TabTargetKind
    {
        Name,
        GameZone,
        Chat,
        History,
    }

    private static bool IsFocusWithinElement(DependencyObject root, DependencyObject? focused)
    {
        while (focused != null)
        {
            if (ReferenceEquals(focused, root))
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    private static DependencyObject? GetVisualOrLogicalParent(DependencyObject current)
    {
        try
        {
            if (current is System.Windows.Media.Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return System.Windows.Media.VisualTreeHelper.GetParent(current);
            }
        }
        catch
        {
            // fallback below
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }

    private int TryFindGameZoneIndex(IReadOnlyList<TabTarget> targets)
    {
        for (var i = 0; i < targets.Count; i++)
        {
            if (targets[i].Kind == TabTargetKind.GameZone)
            {
                return i;
            }
        }

        return -1;
    }

    private static int TryFindHistoryIndex(IReadOnlyList<TabTarget> targets)
    {
        for (var i = 0; i < targets.Count; i++)
        {
            if (targets[i].Kind == TabTargetKind.History)
            {
                return i;
            }
        }

        return -1;
    }

    private bool IsGameZoneContext(DependencyObject focused)
    {
        if (GameZoneHost != null && (GameZoneHost.IsKeyboardFocusWithin || IsFocusWithinElement(GameZoneHost, focused)))
        {
            return true;
        }

        var zoneContext = GameZoneHost?.DataContext;
        if (zoneContext == null)
        {
            return false;
        }

        var current = focused as FrameworkElement;
        while (current != null)
        {
            if (ReferenceEquals(current.DataContext, zoneContext))
            {
                return true;
            }

            current = GetVisualOrLogicalParent(current) as FrameworkElement;
        }

        return false;
    }

}
