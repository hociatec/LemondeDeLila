using System;
using System.Windows;
using System.Windows.Input;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView
{
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
}
