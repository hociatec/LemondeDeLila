using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.Shell.Models;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView : UserControl, IInitialFocusTarget, IGameFocusHost
{
    private GameRoomViewModel? _vm;
    private IDisposable? _focusHostLease;
    private IScreenReaderAnnouncer? _screenReader;
    private GameRoomFocusPolicy? _focusPolicy;
    private Action? _historyFocusedUpdateHandler;

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
        HookGameZoneHostEvents(attach: true);
        HookFocusRequests(DataContext as GameRoomViewModel);
        HookHistoryUpdates();
        RequestFocusGameZoneInternal(GameFocusReason.InitialLoad);
    }

    private void OnUnloaded(object? sender, RoutedEventArgs e)
    {
        HookGameZoneHostEvents(attach: false);
        HookFocusRequests(null);
        UnhookHistoryUpdates();
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
        _vm?.GameZone.FocusCoordinator.CancelPendingRequests();

        if (HistoryHost == null)
        {
            return;
        }

        var target = HistoryHost.FocusTarget ?? (HistoryHost as FrameworkElement);
        if (target == null)
        {
            return;
        }

        if (_focusPolicy != null)
        {
            _focusPolicy.RunInternal(() =>
            {
                target.Focus();
                Keyboard.Focus(target);
            });
        }
        else
        {
            target.Focus();
            Keyboard.Focus(target);
        }

        HistoryHost.FocusToBottom();
    }

    internal void FocusChatInput()
    {
        _vm?.GameZone.FocusCoordinator.CancelPendingRequests();

        if (ChatInput == null || ChatHost?.Visibility != Visibility.Visible || !ChatInput.IsEnabled)
        {
            return;
        }

        if (_focusPolicy != null)
        {
            _focusPolicy.RunInternal(() =>
            {
                ChatInput.Focus();
                Keyboard.Focus(ChatInput);
            });
        }
        else
        {
            ChatInput.Focus();
            Keyboard.Focus(ChatInput);
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

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        _focusPolicy?.NotifyUserKeyDown(key);
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

}
