using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Game.Play.Actions.Services;
using client_win.Modules.Game.Play.Choices.ViewModels;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal sealed class GamePlayCommands
{
    private readonly Func<GameSession?> _getSession;
    private readonly Func<bool> _isSpectator;
    private readonly GamePlayActionDispatcher _actions;
    private readonly GamePlayChoicesViewModel _choices;
    private readonly Func<GameStateDto?, bool> _canStartAskCardSelection;
    private readonly Func<Task> _requestTurnAsync;
    private readonly Action<string> _emitMessage;

    internal GamePlayCommands(
        Func<GameSession?> getSession,
        Func<bool> isSpectator,
        GamePlayActionDispatcher actions,
        GamePlayChoicesViewModel choices,
        Func<GameStateDto?, bool> canStartAskCardSelection,
        Func<Task> requestTurnAsync,
        Action<string> emitMessage)
    {
        _getSession = getSession ?? throw new ArgumentNullException(nameof(getSession));
        _isSpectator = isSpectator ?? throw new ArgumentNullException(nameof(isSpectator));
        _actions = actions ?? throw new ArgumentNullException(nameof(actions));
        _choices = choices ?? throw new ArgumentNullException(nameof(choices));
        _canStartAskCardSelection = canStartAskCardSelection ?? throw new ArgumentNullException(nameof(canStartAskCardSelection));
        _requestTurnAsync = requestTurnAsync ?? throw new ArgumentNullException(nameof(requestTurnAsync));
        _emitMessage = emitMessage ?? throw new ArgumentNullException(nameof(emitMessage));

        Roll = new AsyncRelayCommand(
            async () => { await TrySendRollAsync().ConfigureAwait(true); },
            canExecute: () => !_isSpectator() && _actions.CanSendRoll(_getSession()));

        ExchangeAccept = new AsyncRelayCommand(
            async () =>
            {
                await TrySendFirstAvailableSimpleActionAsync("answer_ask_card_accept", "exchange_accept")
                    .ConfigureAwait(true);
            },
            canExecute: () =>
                !_isSpectator() &&
                (_actions.CanSendSimpleAction(_getSession(), "answer_ask_card_accept") ||
                 _actions.CanSendSimpleAction(_getSession(), "exchange_accept")));

        ExchangeRefuse = new AsyncRelayCommand(
            async () =>
            {
                await TrySendFirstAvailableSimpleActionAsync("answer_ask_card_refuse", "exchange_refuse")
                    .ConfigureAwait(true);
            },
            canExecute: () =>
                !_isSpectator() &&
                (_actions.CanSendSimpleAction(_getSession(), "answer_ask_card_refuse") ||
                 _actions.CanSendSimpleAction(_getSession(), "exchange_refuse")));

        Draw = new AsyncRelayCommand(
            async () => { await TrySendSimpleActionAsync("draw").ConfigureAwait(true); },
            canExecute: () => !_isSpectator() && _actions.CanSendSimpleAction(_getSession(), "draw"));

        DiscardSelect = new AsyncRelayCommand(
            () =>
            {
                var state = _getSession()?.LastState;
                if (state != null)
                {
                    _choices.TryStartDiscardSelection(state, _emitMessage);
                }
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator() && _choices.HasDiscardChoices(_getSession()?.LastState));

        AskCardSelect = new AsyncRelayCommand(
            () =>
            {
                var state = _getSession()?.LastState;
                if (state != null)
                {
                    _choices.TryStartAskSelection(state, _emitMessage);
                }
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator() && _canStartAskCardSelection(_getSession()?.LastState));

        SimpleActionFromHint = new AsyncRelayCommand<string>(
            async actionType =>
            {
                if (string.IsNullOrWhiteSpace(actionType))
                {
                    return;
                }

                await TrySendSimpleActionAsync(actionType).ConfigureAwait(true);
            },
            canExecute: actionType =>
                !_isSpectator() &&
                !string.IsNullOrWhiteSpace(actionType) &&
                _actions.CanSendSimpleAction(_getSession(), actionType));

        SendKey = new AsyncRelayCommand<string>(
            async key =>
            {
                var session = _getSession();
                if (session == null || string.IsNullOrWhiteSpace(key))
                {
                    return;
                }

                await session.SendKeyAsync(key, CancellationToken.None).ConfigureAwait(false);
            },
            canExecute: key =>
                !_isSpectator() &&
                _getSession() != null &&
                !string.IsNullOrWhiteSpace(key));

        TurnInfo = new AsyncRelayCommand(
            _requestTurnAsync,
            canExecute: () => !_isSpectator() && _getSession() != null);
    }

    internal AsyncRelayCommand Roll { get; }
    internal AsyncRelayCommand ExchangeAccept { get; }
    internal AsyncRelayCommand ExchangeRefuse { get; }
    internal AsyncRelayCommand Draw { get; }
    internal AsyncRelayCommand DiscardSelect { get; }
    internal AsyncRelayCommand AskCardSelect { get; }
    internal AsyncRelayCommand<string> SimpleActionFromHint { get; }
    internal AsyncRelayCommand<string> SendKey { get; }
    internal AsyncRelayCommand TurnInfo { get; }

    internal void RefreshCanExecute()
    {
        Roll.RaiseCanExecuteChanged();
        ExchangeAccept.RaiseCanExecuteChanged();
        ExchangeRefuse.RaiseCanExecuteChanged();
        Draw.RaiseCanExecuteChanged();
        DiscardSelect.RaiseCanExecuteChanged();
        AskCardSelect.RaiseCanExecuteChanged();
        SimpleActionFromHint.RaiseCanExecuteChanged();
        SendKey.RaiseCanExecuteChanged();
        TurnInfo.RaiseCanExecuteChanged();
    }

    private async Task TrySendRollAsync(CancellationToken cancellationToken = default)
    {
        var session = _getSession();
        if (session == null) return;
        if (!CanSendActionNow(session)) return;
        await _actions.SendRollAsync(session, cancellationToken).ConfigureAwait(false);
    }

    private async Task TrySendSimpleActionAsync(string actionType, CancellationToken cancellationToken = default)
    {
        var session = _getSession();
        if (session == null) return;
        if (!CanSendActionNow(session)) return;
        await _actions.SendSimpleActionAsync(session, actionType, cancellationToken).ConfigureAwait(false);
    }

    private async Task TrySendFirstAvailableSimpleActionAsync(params string[] actionTypes)
    {
        var session = _getSession();
        if (session == null) return;

        foreach (var actionType in actionTypes)
        {
            if (string.IsNullOrWhiteSpace(actionType))
            {
                continue;
            }

            if (_actions.CanSendSimpleAction(session, actionType))
            {
                await _actions.SendSimpleActionAsync(session, actionType).ConfigureAwait(false);
                return;
            }
        }
    }

    private bool CanSendActionNow(GameSession session) => session.IsConnected && !_isSpectator();
}
