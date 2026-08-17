using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Shell.Models;
using client_win.Modules.Game.Shell.Services;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView
{
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
        PrepareSecondaryFocus();

        if (HistoryHost == null || !HistoryHost.IsVisible || !HistoryHost.IsEnabled)
        {
            return false;
        }

        var target = HistoryHost.FocusTarget ?? (HistoryHost as FrameworkElement);
        if (target == null || !target.IsVisible || !target.IsEnabled)
        {
            return false;
        }

        var ok = RunFocusAttempt(() =>
        {
            var focused = TryFocusElement(target);
            return focused ||
                   ReferenceEquals(Keyboard.FocusedElement, target) ||
                   GameRoomViewFocusTree.IsFocusWithinElement(target, Keyboard.FocusedElement as DependencyObject) ||
                   HistoryHost.IsKeyboardFocusWithin;
        });

        HistoryHost.FocusToBottom();
        return ok;
    }

    private bool TryFocusChatInternal()
    {
        PrepareSecondaryFocus();

        if (ChatInput == null || ChatHost?.Visibility != Visibility.Visible || !ChatInput.IsEnabled || !ChatInput.IsVisible)
        {
            return false;
        }

        return RunFocusAttempt(() =>
        {
            var ok = TryFocusElement(ChatInput);
            return ok || ChatInput.IsKeyboardFocusWithin || ReferenceEquals(Keyboard.FocusedElement, ChatInput);
        });
    }

    private void PrepareSecondaryFocus()
    {
        _vm?.GameZone.FocusCoordinator.CancelPendingRequests();
        CancelPendingGamePlayFocusRecovery();
    }

    private bool RunFocusAttempt(Func<bool> attempt)
    {
        if (_focusPolicy != null)
        {
            return _focusPolicy.RunInternal(attempt);
        }

        return attempt();
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
        QueueAction(DispatcherPriority.Input, () => RequestFocusGameZoneInternal(GameFocusReason.InitialLoad));
        QueueAction(DispatcherPriority.ApplicationIdle, () => RequestFocusGameZoneInternal(GameFocusReason.InitialLoad));
    }
}
