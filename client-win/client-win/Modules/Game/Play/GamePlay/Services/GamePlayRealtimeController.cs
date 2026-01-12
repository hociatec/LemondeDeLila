using System;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Threading;
using client_win.Modules.Game.Play.Announcements.Services;
using client_win.Modules.Game.Play.Board.Services;
using client_win.Modules.Game.Play.Choices.ViewModels;
using client_win.Modules.Game.Play.Grid.ViewModels;
using client_win.Modules.Game.Play.Panels.Services;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal sealed class GamePlayRealtimeController
{
    private readonly Dispatcher _dispatcher;
    private readonly GamePlayPanelRequester _panels;
    private readonly GamePlayStateProjector _projector;
    private readonly GamePlayStatePresenter _presenter;
    private readonly GamePlayAnnouncementRouter _announcementRouter;
    private readonly GamePlayEndgameSoundPlayer _endgameSounds;
    private readonly GamePlayDiceSoundPlayer _diceSounds;
    private readonly GamePlayChoicesViewModel _choices;
    private readonly GridBoardViewModel _grid;
    private readonly Action<GameStateDto> _syncShortcuts;
    private readonly Func<GameStateDto, bool> _canStartAskCardSelection;
    private readonly Action<string> _emitMessage;
    private readonly Action _requestFocus;
    private readonly Action _refreshCanExecute;
    private readonly Action<string, string> _onGameStatusChanged;
    private readonly Action<bool> _setIsBotThinking;
    private readonly Action<string> _setStateSummary;
    private readonly Action<string> _setPendingText;
    private readonly Action<string> _setActionsText;
    private readonly Action<string> _setBoardText;

    private bool _skipLogReplayOnce = true;
    private string? _lastGameStatus;
    private int? _viewerPlayerId;
    private int? _lastStateTurnPlayerId;
    private int _pendingForcedTurnAnnouncements;

    internal GamePlayRealtimeController(
        Dispatcher dispatcher,
        GamePlayPanelRequester panels,
        GamePlayStateProjector projector,
        GamePlayStatePresenter presenter,
        GamePlayAnnouncementRouter announcementRouter,
        GamePlayEndgameSoundPlayer endgameSounds,
        GamePlayDiceSoundPlayer diceSounds,
        GamePlayChoicesViewModel choices,
        GridBoardViewModel grid,
        Action<GameStateDto> syncShortcuts,
        Func<GameStateDto, bool> canStartAskCardSelection,
        Action<string> emitMessage,
        Action requestFocus,
        Action refreshCanExecute,
        Action<string, string> onGameStatusChanged,
        Action<bool> setIsBotThinking,
        Action<string> setStateSummary,
        Action<string> setPendingText,
        Action<string> setActionsText,
        Action<string> setBoardText)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _panels = panels ?? throw new ArgumentNullException(nameof(panels));
        _projector = projector ?? throw new ArgumentNullException(nameof(projector));
        _presenter = presenter ?? throw new ArgumentNullException(nameof(presenter));
        _announcementRouter = announcementRouter ?? throw new ArgumentNullException(nameof(announcementRouter));
        _endgameSounds = endgameSounds ?? throw new ArgumentNullException(nameof(endgameSounds));
        _diceSounds = diceSounds ?? throw new ArgumentNullException(nameof(diceSounds));
        _choices = choices ?? throw new ArgumentNullException(nameof(choices));
        _grid = grid ?? throw new ArgumentNullException(nameof(grid));
        _syncShortcuts = syncShortcuts ?? throw new ArgumentNullException(nameof(syncShortcuts));
        _canStartAskCardSelection = canStartAskCardSelection ?? throw new ArgumentNullException(nameof(canStartAskCardSelection));
        _emitMessage = emitMessage ?? throw new ArgumentNullException(nameof(emitMessage));
        _requestFocus = requestFocus ?? throw new ArgumentNullException(nameof(requestFocus));
        _refreshCanExecute = refreshCanExecute ?? throw new ArgumentNullException(nameof(refreshCanExecute));
        _onGameStatusChanged = onGameStatusChanged ?? throw new ArgumentNullException(nameof(onGameStatusChanged));
        _setIsBotThinking = setIsBotThinking ?? throw new ArgumentNullException(nameof(setIsBotThinking));
        _setStateSummary = setStateSummary ?? throw new ArgumentNullException(nameof(setStateSummary));
        _setPendingText = setPendingText ?? throw new ArgumentNullException(nameof(setPendingText));
        _setActionsText = setActionsText ?? throw new ArgumentNullException(nameof(setActionsText));
        _setBoardText = setBoardText ?? throw new ArgumentNullException(nameof(setBoardText));
    }

    internal void ResetForInitialize()
    {
        _skipLogReplayOnce = true;
        _lastStateTurnPlayerId = null;
        _lastGameStatus = null;
        _viewerPlayerId = null;
        _pendingForcedTurnAnnouncements = 0;
        _diceSounds.Reset();
    }

    internal void NoteForcedTurnRequest()
    {
        _pendingForcedTurnAnnouncements = Math.Min(3, _pendingForcedTurnAnnouncements + 1);
    }

    internal void HandleTurnUpdated(TurnInfoDto info)
    {
        _dispatcher.InvokeAsync(() =>
        {
            var force = _pendingForcedTurnAnnouncements > 0;
            if (force) _pendingForcedTurnAnnouncements = Math.Max(0, _pendingForcedTurnAnnouncements - 1);
            _announcementRouter.TryHandleTurnUpdate(info, _emitMessage, force: force);
        }, DispatcherPriority.Background);
    }

    internal void HandleStateUpdated(GameStateDto state)
    {
        _panels.OnStateUpdated(state);

        _dispatcher.InvokeAsync(() =>
        {
            if (_skipLogReplayOnce)
            {
                _projector.PrimeLogCursor(state);
                _skipLogReplayOnce = false;
            }

            var presented = _presenter.Present(state);

            // IMPORTANT:
            // Annoncer d'abord les nouvelles lignes d'historique (ordre serveur),
            // puis seulement ensuite appliquer les changements d'interface (ex: liste de choix),
            // sinon NVDA lit le contrôle (ex: "Échange") avant le message "Case 11: Échange ...".
            foreach (var msg in presented.newLogMessages)
            {
                _emitMessage(msg);
            }

            var nextStatus = state.Status ?? string.Empty;
            var previousStatus = _lastGameStatus ?? string.Empty;
            _lastGameStatus = nextStatus;
            if (!string.Equals(previousStatus, nextStatus, StringComparison.OrdinalIgnoreCase))
            {
                _onGameStatusChanged(previousStatus, nextStatus);
            }
            if (string.Equals(previousStatus, "started", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(nextStatus, "started", StringComparison.OrdinalIgnoreCase))
            {
                _requestFocus();
            }

            _viewerPlayerId = GamePlayExtrasParser.ExtractViewerPlayerId(state);
            _choices.UpdateFromState(state, _viewerPlayerId, _canStartAskCardSelection);

            _diceSounds.TryPlayDiceRollSound(state);

            if (!string.Equals(previousStatus, "finished", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(nextStatus, "finished", StringComparison.OrdinalIgnoreCase))
            {
                _endgameSounds.TryPlayEndgameSound(state, _viewerPlayerId);
            }

            _setIsBotThinking(presented.isBotThinking);
            _setStateSummary(presented.stateSummary);
            _setPendingText(presented.pendingText);
            _setActionsText(presented.actionsText);
            _setBoardText(GamePlayBoardTextBuilder.Build(state));

            _syncShortcuts(state);
            _grid.SyncFromState(state, _viewerPlayerId);

            _refreshCanExecute();
            TryAnnounceTurnFromState(state);
        }, DispatcherPriority.Background);
    }

    private void TryAnnounceTurnFromState(GameStateDto state)
    {
        if (!string.Equals(state.Status, "started", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var currentPlayerId = state.Turn?.CurrentPlayerId;
        if (currentPlayerId == null)
        {
            return;
        }

        if (_lastStateTurnPlayerId == currentPlayerId)
        {
            return;
        }

        _lastStateTurnPlayerId = currentPlayerId;

        var username = state.Players?
            .FirstOrDefault(p => p != null && p.Id == currentPlayerId.Value)?
            .Username;

        _announcementRouter.TryHandleTurnUpdate(
            new TurnInfoDto
            {
                CurrentPlayerId = currentPlayerId,
                CurrentPlayerUsername = string.IsNullOrWhiteSpace(username) ? null : username.Trim()
            },
            emitHistoryMessage: _ => { });
    }
}
