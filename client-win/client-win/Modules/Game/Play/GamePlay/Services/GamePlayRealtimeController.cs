using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using client_win.Modules.Game.Play.Announcements.Services;
using client_win.Modules.Game.Play.Board.Services;
using client_win.Modules.Game.Play.Choices.ViewModels;
using client_win.Modules.Game.Play.Common;
using client_win.Modules.Game.Play.Grid.ViewModels;
using client_win.Modules.Game.Play.Panels.Services;
using client_win.Modules.Game.Play.Session.Dtos;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;
using client_win.Modules.Game.Play.GamePlay.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal sealed class GamePlayRealtimeController
{
    private const int RecentHistoryLinesMax = 200;

    private readonly Dispatcher _dispatcher;
    private readonly GamePlayPanelRequester _panels;
    private readonly GamePlayStateProjector _projector;
    private readonly GamePlayStatePresenter _presenter;
    private readonly GamePlayAnnouncementRouter _announcementRouter;
    private readonly GamePlayEndgameSoundPlayer _endgameSounds;
    private readonly GamePlayDiceSoundPlayer _diceSounds;
    private readonly GamePlayLogSoundPlayer _logSounds;
    private readonly GamePlayChoicesViewModel _choices;
    private readonly GridBoardViewModel _grid;
    private readonly Action<GameStateDto> _syncShortcuts;
    private readonly Func<GameStateDto, bool> _canStartAskCardSelection;
    private readonly Action<GamePlayHistoryMessage> _emitMessage;
    private readonly Action _requestFocus;
    private readonly Action _refreshCanExecute;
    private readonly Action<string, string> _onGameStatusChanged;
    private readonly Action<bool> _onStartReadyChanged;
    private readonly Action<bool> _setIsBotThinking;
    private readonly Action<string> _setStateSummary;
    private readonly Action<string> _setPendingText;
    private readonly Action<string> _setActionsText;
    private readonly Action<string> _setBoardText;

    private bool _skipLogReplayOnce = true;
    private string? _lastGameStatus;
    private string? _lastGamePhase;
    private int? _viewerPlayerId;
    private int? _lastStateTurnPlayerId;
    private string _lastPendingType = string.Empty;
    private string _lastPendingFocusSignature = string.Empty;
    private bool _lastBotThinking;
    private bool _endgameFeedbackEmitted;
    private bool _endgamePublicMessagesEmitted;
    private bool _endgameHeaderEmitted;
    private string _lastEndgameWinnerNameFromLog = string.Empty;
    private bool _lastEndgameDrawFromLog;
    private bool _finishedStatusEnforced;
    private bool _lastStartReady;
    private bool _lastStartReadyKnown;
    private bool _lastViewerTurnActionable;
    private bool _lastViewerMustChoosePawn;
    private int _pendingForcedTurnAnnouncements;
    private Dictionary<string, int>? _lastViewerHandCounts;
    private readonly object _statePumpLock = new();
    private readonly List<GameStateDto> _pendingStates = new();
    private int _statePumpRunning;
    private readonly Queue<string> _recentHistoryLines = new();
    private readonly HashSet<string> _recentHistoryLineSet = new(StringComparer.Ordinal);

    internal GamePlayRealtimeController(
        Dispatcher dispatcher,
        GamePlayPanelRequester panels,
        GamePlayStateProjector projector,
        GamePlayStatePresenter presenter,
        GamePlayAnnouncementRouter announcementRouter,
        GamePlayEndgameSoundPlayer endgameSounds,
        GamePlayDiceSoundPlayer diceSounds,
        GamePlayLogSoundPlayer logSounds,
        GamePlayChoicesViewModel choices,
        GridBoardViewModel grid,
        Action<GameStateDto> syncShortcuts,
        Func<GameStateDto, bool> canStartAskCardSelection,
        Action<GamePlayHistoryMessage> emitMessage,
        Action requestFocus,
        Action refreshCanExecute,
        Action<string, string> onGameStatusChanged,
        Action<bool> onStartReadyChanged,
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
        _logSounds = logSounds ?? throw new ArgumentNullException(nameof(logSounds));
        _choices = choices ?? throw new ArgumentNullException(nameof(choices));
        _grid = grid ?? throw new ArgumentNullException(nameof(grid));
        _syncShortcuts = syncShortcuts ?? throw new ArgumentNullException(nameof(syncShortcuts));
        _canStartAskCardSelection = canStartAskCardSelection ?? throw new ArgumentNullException(nameof(canStartAskCardSelection));
        _emitMessage = emitMessage ?? throw new ArgumentNullException(nameof(emitMessage));
        _requestFocus = requestFocus ?? throw new ArgumentNullException(nameof(requestFocus));
        _refreshCanExecute = refreshCanExecute ?? throw new ArgumentNullException(nameof(refreshCanExecute));
        _onGameStatusChanged = onGameStatusChanged ?? throw new ArgumentNullException(nameof(onGameStatusChanged));
        _onStartReadyChanged = onStartReadyChanged ?? throw new ArgumentNullException(nameof(onStartReadyChanged));
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
        _lastGamePhase = null;
        _viewerPlayerId = null;
        _pendingForcedTurnAnnouncements = 0;
        _lastPendingType = string.Empty;
        _lastPendingFocusSignature = string.Empty;
        _lastBotThinking = false;
        _endgameFeedbackEmitted = false;
        _endgamePublicMessagesEmitted = false;
        _endgameHeaderEmitted = false;
        _lastEndgameWinnerNameFromLog = string.Empty;
        _lastEndgameDrawFromLog = false;
        _finishedStatusEnforced = false;
        _lastStartReady = false;
        _lastStartReadyKnown = false;
        _lastViewerTurnActionable = false;
        _lastViewerMustChoosePawn = false;
        _lastViewerHandCounts = null;
        lock (_statePumpLock)
        {
            _pendingStates.Clear();
        }
        Interlocked.Exchange(ref _statePumpRunning, 0);
        _diceSounds.Reset();
        _recentHistoryLines.Clear();
        _recentHistoryLineSet.Clear();
    }

    private void TrackRecentHistoryLine(string message)
    {
        var trimmed = (message ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return;
        }

        if (_recentHistoryLineSet.Contains(trimmed))
        {
            return;
        }

        _recentHistoryLines.Enqueue(trimmed);
        _recentHistoryLineSet.Add(trimmed);
        while (_recentHistoryLines.Count > RecentHistoryLinesMax)
        {
            var removed = _recentHistoryLines.Dequeue();
            _recentHistoryLineSet.Remove(removed);
        }
    }

    private bool WasRecentlyEmitted(string message)
    {
        var trimmed = (message ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return false;
        }
        return _recentHistoryLineSet.Contains(trimmed);
    }

    private static bool LooksLikePublicEndgameLine(string message)
    {
        var trimmed = (message ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return false;
        }
        // Typical format: "{name} dit: {phrase}"
        var idx = trimmed.IndexOf(" dit:", StringComparison.OrdinalIgnoreCase);
        return idx > 0 && idx < trimmed.Length - 5;
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
            // Évite le spam : les tours sont déjà annoncés via l'historique serveur.
            // Garder seulement les annonces "forcées" (ex: demande manuelle de game.turn).
            if (force &&
                string.Equals(_lastGameStatus, "started", StringComparison.OrdinalIgnoreCase) &&
                (_lastStartReady || !_lastStartReadyKnown))
            {
        _announcementRouter.TryHandleTurnUpdate(info, msg => _emitMessage(new GamePlayHistoryMessage(msg)), force: true);
            }
        }, DispatcherPriority.Background);
    }

    internal void HandleStateUpdated(GameStateDto state)
    {
        _panels.OnStateUpdated(state);
        lock (_statePumpLock)
        {
            if (_pendingStates.Count == 0)
            {
                _pendingStates.Add(state);
            }
            else
            {
                // Coalescer les rafales d'updates identiques (même statut) tout en conservant
                // les transitions importantes (ex: started -> finished -> setup).
                var lastIndex = _pendingStates.Count - 1;
                var last = _pendingStates[lastIndex];
                var lastStatus = NormalizeStatus(last);
                var nextStatus = NormalizeStatus(state);

                if (string.Equals(lastStatus, nextStatus, StringComparison.OrdinalIgnoreCase))
                {
                    _pendingStates[lastIndex] = state;
                }
                else
                {
                    _pendingStates.Add(state);
                }
            }
        }

        if (Interlocked.CompareExchange(ref _statePumpRunning, 1, 0) != 0)
        {
            return;
        }

        _dispatcher.InvokeAsync(() =>
        {
            try
            {
                while (true)
                {
                    GameStateDto? next;
                    lock (_statePumpLock)
                    {
                        if (_pendingStates.Count == 0)
                        {
                            next = null;
                        }
                        else
                        {
                            next = _pendingStates[0];
                            _pendingStates.RemoveAt(0);
                        }
                    }

                    if (next == null)
                    {
                        break;
                    }

                    ProcessStateOnUi(next);
                }
            }
            finally
            {
                Interlocked.Exchange(ref _statePumpRunning, 0);

                lock (_statePumpLock)
                {
                    if (_pendingStates.Count > 0 &&
                        Interlocked.CompareExchange(ref _statePumpRunning, 1, 0) == 0)
                    {
                        _dispatcher.InvokeAsync(DrainStateQueueOnUi, DispatcherPriority.Background);
                    }
                }
            }
        }, DispatcherPriority.Background);
    }

    internal void HandleEnded(GameEndedDto ended)
    {
        if (ended == null)
        {
            return;
        }

        _dispatcher.InvokeAsync(() =>
        {
            if (ended.ViewerPlayerId != null && ended.ViewerPlayerId.Value > 0)
            {
                _viewerPlayerId = ended.ViewerPlayerId.Value;
            }

            if (!_endgameHeaderEmitted)
            {
                _endgameHeaderEmitted = true;
                TryEmitGenericEndgameSummary(ended);
            }

            // Always try to emit per-player endgame phrases (victory/defeat messages from profiles),
            // even if the endgame was already detected from state/log transitions.
            if (!_endgamePublicMessagesEmitted)
            {
                _endgamePublicMessagesEmitted = true;
                TryEmitPublicEndgameMessages(ended);
            }

            // Emit sounds only once.
            if (!_endgameFeedbackEmitted)
            {
                _endgameFeedbackEmitted = true;
                _endgameSounds.TryPlayEndgameSound(ended, _viewerPlayerId);
            }
            MaybeEnforceFinishedStatus();
        }, DispatcherPriority.Background);
    }

    private void MaybeEnforceFinishedStatus()
    {
        if (_finishedStatusEnforced)
        {
            return;
        }

        if (string.Equals(_lastGameStatus, "finished", StringComparison.OrdinalIgnoreCase))
        {
            _finishedStatusEnforced = true;
            return;
        }

        _finishedStatusEnforced = true;
        try
        {
            var previousStatus = _lastGameStatus ?? string.Empty;
            _onGameStatusChanged(previousStatus, "finished");
        }
        catch
        {
            // best-effort
        }
    }

    private void DrainStateQueueOnUi()
    {
        try
        {
            while (true)
            {
                GameStateDto? next;
                lock (_statePumpLock)
                {
                    if (_pendingStates.Count == 0)
                    {
                        next = null;
                    }
                    else
                    {
                        next = _pendingStates[0];
                        _pendingStates.RemoveAt(0);
                    }
                }

                if (next == null)
                {
                    break;
                }

                ProcessStateOnUi(next);
            }
        }
        finally
        {
            Interlocked.Exchange(ref _statePumpRunning, 0);

            lock (_statePumpLock)
            {
                if (_pendingStates.Count > 0 &&
                    Interlocked.CompareExchange(ref _statePumpRunning, 1, 0) == 0)
                {
                    _dispatcher.InvokeAsync(DrainStateQueueOnUi, DispatcherPriority.Background);
                }
            }
        }
    }

    private void ProcessStateOnUi(GameStateDto state)
    {
        if (_skipLogReplayOnce)
        {
            _projector.PrimeLogCursor(state);
            _skipLogReplayOnce = false;
        }

        var presented = _presenter.Present(state);
        var extractedViewerId = GamePlayExtrasParser.ExtractViewerPlayerId(state);
        var viewerId = extractedViewerId ?? _viewerPlayerId;
        var viewerUsername = GetUsername(state, viewerId);
        var previousTurnPlayerId = _lastStateTurnPlayerId;
        var previousPendingType = _lastPendingType;
        var previousPendingFocusSignature = _lastPendingFocusSignature;
        var previousBotThinking = _lastBotThinking;
        var currentHandCounts = BuildHandCounts(GamePlayExtrasParser.ExtractViewerHandLabels(state));
        var nextPendingType = PawnPendingTypes.Normalize(state.Pending?.Type);
        var nextPendingFocusSignature = BuildPendingFocusSignature(state.Pending);

        var nextStatus = NormalizeStatus(state);
        var nextPhase = (state.Phase ?? string.Empty).Trim();
        var previousStatus = _lastGameStatus ?? string.Empty;
        var previousPhase = _lastGamePhase ?? string.Empty;
        var previousStartReady = _lastStartReady;
        var previousViewerTurnActionable = _lastViewerTurnActionable;
        var previousViewerMustChoosePawn = _lastViewerMustChoosePawn;
        var isEndgameContext =
            string.Equals(nextStatus, "finished", StringComparison.OrdinalIgnoreCase) ||
            HasOutcomeData(state);
        var newLogMessages = presented.newLogMessages.ToList();
        var batchHasDiceLog = newLogMessages.Any(entry => IsDiceLogMessage(entry?.Message));

        foreach (var entry in newLogMessages)
        {
            var trimmed = entry?.Message ?? string.Empty;
            _logSounds.TryPlayForLogMessage(trimmed, viewerUsername, suppressDrawSound: batchHasDiceLog);

            // Best-effort fallback: if the server logged the winner/draw, keep it so the client can still
            // emit a proper endgame header even if winner/outcome metadata is missing.
            if (isEndgameContext)
            {
                var msg = trimmed.Trim();
                if (msg.StartsWith("Victoire de ", StringComparison.OrdinalIgnoreCase))
                {
                    var name = msg.Substring("Victoire de ".Length).Trim();
                    if (name.EndsWith(".", StringComparison.Ordinal)) name = name.Substring(0, name.Length - 1).Trim();
                    if (name.Length > 0)
                    {
                        _lastEndgameWinnerNameFromLog = name;
                    }
                }
                else if (msg.StartsWith("Match nul", StringComparison.OrdinalIgnoreCase))
                {
                    _lastEndgameDrawFromLog = true;
                }
            }

            // When the game is finished, the client emits a single standardized endgame header,
            // so avoid duplicating it with extra summary lines coming from logs.
            var isRedundantEndgameLine =
                isEndgameContext &&
                (trimmed.StartsWith("Partie terminée", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Match nul", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Fin de la manche", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Fin de la partie", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Victoire de", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Victoire écrasante de", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Défaite de", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Defaite de", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Gagnant :", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Gagnants :", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Perdant", StringComparison.OrdinalIgnoreCase) ||
                 trimmed.StartsWith("Perdants", StringComparison.OrdinalIgnoreCase));
            if (isRedundantEndgameLine)
            {
                continue;
            }

            var rewritten = GamePlayLogRewriter.RewriteForViewer(trimmed, viewerUsername, _lastViewerHandCounts, currentHandCounts);
            // Endgame phrases can be emitted via the dedicated game.ended payload AND via logs.
            // Prevent visible duplicates by skipping already-emitted "X dit: ..." lines in endgame context.
            if (isEndgameContext && LooksLikePublicEndgameLine(rewritten) && WasRecentlyEmitted(rewritten))
            {
                continue;
            }
            TrackRecentHistoryLine(rewritten);
            _emitMessage(new GamePlayHistoryMessage(rewritten, entry?.Timestamp));
        }

        _lastGameStatus = nextStatus;
        _lastGamePhase = nextPhase;
        var startReadyKnown = HasStartReadyFlag(state);
        var startReady = IsStartReadyFromState(state);
        var viewerTurnActionable = IsViewerTurnActionableFromState(state);
        var viewerMustChoosePawn = IsViewerMustChoosePawnFromState(state);
        _lastStartReady = startReady;
        _lastStartReadyKnown = startReadyKnown;
        _lastViewerTurnActionable = viewerTurnActionable;
        _lastViewerMustChoosePawn = viewerMustChoosePawn;
        if (!string.Equals(previousStatus, nextStatus, StringComparison.OrdinalIgnoreCase))
        {
            _onGameStatusChanged(previousStatus, nextStatus);
        }
        if (startReady != previousStartReady)
        {
            _onStartReadyChanged(startReady);
        }
        if (string.Equals(nextStatus, "finished", StringComparison.OrdinalIgnoreCase))
        {
            _finishedStatusEnforced = true;
        }
        if (string.Equals(previousStatus, "started", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(nextStatus, "started", StringComparison.OrdinalIgnoreCase))
        {
            _dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(_requestFocus));
        }
        if (!string.Equals(previousStatus, "started", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(nextStatus, "started", StringComparison.OrdinalIgnoreCase))
        {
            _endgameFeedbackEmitted = false;
            _endgamePublicMessagesEmitted = false;
            _finishedStatusEnforced = false;
            _endgameHeaderEmitted = false;
            _lastEndgameWinnerNameFromLog = string.Empty;
            _lastEndgameDrawFromLog = false;
            _recentHistoryLines.Clear();
            _recentHistoryLineSet.Clear();
            // During pawn selection setup, the pending label is the authoritative prompt.
            // Avoid adding a redundant "C'est au tour de ...".
            if (!PawnPendingTypes.IsPawnPendingType(state.Pending?.Type) &&
                (startReady || !startReadyKnown))
            {
                var currentPlayerId = state.Turn?.CurrentPlayerId;
                var currentPlayerUsername = currentPlayerId != null
                    ? state.Players?
                        .FirstOrDefault(p => p != null && p.Id == currentPlayerId.Value)?
                        .Username?
                        .Trim()
                    : null;
                _announcementRouter.TryHandleTurnUpdate(
                    new TurnInfoDto
                    {
                        CurrentPlayerId = currentPlayerId,
                        CurrentPlayerUsername = string.IsNullOrWhiteSpace(currentPlayerUsername)
                            ? null
                            : currentPlayerUsername
                    },
                    msg => _emitMessage(new GamePlayHistoryMessage(msg)),
                    force: true);
            }
        }

        if (startReady && !previousStartReady)
        {
            _dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(_requestFocus));
        }
        if (viewerTurnActionable && !previousViewerTurnActionable)
        {
            _dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(_requestFocus));
        }
        if (previousViewerTurnActionable &&
            viewerTurnActionable &&
            !PawnPendingTypes.IsPawnPendingType(previousPendingType) &&
            !PawnPendingTypes.IsPawnPendingType(nextPendingType) &&
            !string.Equals(
                previousPendingFocusSignature,
                nextPendingFocusSignature,
                StringComparison.Ordinal) &&
            (!string.IsNullOrEmpty(previousPendingFocusSignature) ||
             !string.IsNullOrEmpty(nextPendingFocusSignature)))
        {
            // Some games keep the same actionable turn while rotating prompts/choice lists.
            // Re-anchor focus so keyboard navigation follows the new pending step.
            _dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(_requestFocus));
        }
        if (viewerMustChoosePawn && !previousViewerMustChoosePawn)
        {
            _dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(_requestFocus));
        }
        if (!viewerMustChoosePawn && previousViewerMustChoosePawn)
        {
            // End of pawn selection: move focus back to the next actionable gameplay target
            // (board cell / roll shortcut context) instead of leaving it on the old choice list.
            _dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(_requestFocus));
        }
        if (PawnPendingTypes.IsPawnPendingType(previousPendingType) &&
            !PawnPendingTypes.IsPawnPendingType(state.Pending?.Type) &&
            (state.Actions?.Count ?? 0) > 0)
        {
            // Some engines do not flag viewerMustChoosePawn or viewerTurnActionable.
            // When pawn selection ends and actions are available (ex: roll), re-anchor focus.
            _dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(_requestFocus));
        }

        if (extractedViewerId != null && extractedViewerId.Value > 0)
        {
            _viewerPlayerId = extractedViewerId;
        }
        _choices.UpdateFromState(state, _viewerPlayerId, _canStartAskCardSelection);

        _diceSounds.TryPlayDiceRollSound(state);

        var becameFinished =
            !string.Equals(previousStatus, "finished", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(nextStatus, "finished", StringComparison.OrdinalIgnoreCase);
        var leftStarted =
            string.Equals(previousStatus, "started", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(nextStatus, "started", StringComparison.OrdinalIgnoreCase);
        var endedWithOutcomeData = leftStarted && HasOutcomeData(state);
        if ((becameFinished || endedWithOutcomeData) && !_endgameHeaderEmitted)
        {
            _endgameHeaderEmitted = true;
            TryEmitGenericEndgameSummary(state);
        }
        if (!_endgameFeedbackEmitted && (becameFinished || endedWithOutcomeData))
        {
            _endgameFeedbackEmitted = true;
            _endgameSounds.TryPlayEndgameSound(state, viewerId);
        }

        _setIsBotThinking(presented.isBotThinking);
        _setStateSummary(presented.stateSummary);
        _setPendingText(presented.pendingText);
        _setActionsText(presented.actionsText);
        _setBoardText(GamePlayBoardTextBuilder.Build(state));

        _syncShortcuts(state);
        _grid.SyncFromState(state, _viewerPlayerId);

        var endedPawnSelection =
            PawnPendingTypes.IsPawnPendingType(previousPendingType) &&
            !PawnPendingTypes.IsPawnPendingType(state.Pending?.Type);

        _lastPendingType = nextPendingType;
        _lastPendingFocusSignature = nextPendingFocusSignature;
        _lastBotThinking = state.BotThinking;
        _lastViewerHandCounts = currentHandCounts;
        _refreshCanExecute();
        TryAnnounceTurnFromState(state, force: endedPawnSelection);
    }

    private static string BuildPendingFocusSignature(GamePendingDto? pending)
    {
        if (pending == null)
        {
            return string.Empty;
        }

        var type = PawnPendingTypes.Normalize(pending.Type);
        var label = (pending.Label ?? string.Empty).Trim();
        var question = (pending.Question ?? string.Empty).Trim();
        var playerId = pending.PlayerId?.ToString() ?? string.Empty;
        var targetPlayerId = pending.TargetPlayerId?.ToString() ?? string.Empty;
        var choices = pending.Choices == null
            ? string.Empty
            : string.Join(
                "\u001f",
                pending.Choices
                    .Where(choice => !string.IsNullOrWhiteSpace(choice))
                    .Select(choice => choice.Trim()));
        var data = pending.Data.ValueKind is System.Text.Json.JsonValueKind.Object or System.Text.Json.JsonValueKind.Array
            ? pending.Data.ToString().Trim()
            : string.Empty;

        return string.Join(
            "\u001e",
            new[]
            {
                type,
                playerId,
                targetPlayerId,
                label,
                question,
                choices,
                data,
            });
    }

    private static bool IsDiceLogMessage(string? message)
    {
        var trimmed = (message ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return false;
        }

        return trimmed.IndexOf("lance le dé", StringComparison.OrdinalIgnoreCase) >= 0 ||
               trimmed.IndexOf("relance le dé", StringComparison.OrdinalIgnoreCase) >= 0;
    }

    private static string NormalizeStatus(GameStateDto state)
    {
        var status = (state.Status ?? string.Empty).Trim();
        if (!string.Equals(status, "started", StringComparison.OrdinalIgnoreCase))
        {
            return status;
        }

        // Robustesse : si le serveur a déjà marqué un winner/finishedAt dans le metadata,
        // mais que status reste "started" (race / transition), considérer la partie finie côté client
        // pour permettre la relance (Entrée) et le reset (X).
        try
        {
            var meta = state.Metadata;
            if (meta.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return status;
            }

            if (meta.TryGetProperty("finishedAt", out var finishedAt) &&
                finishedAt.ValueKind == System.Text.Json.JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(finishedAt.GetString()))
            {
                return "finished";
            }

            if (meta.TryGetProperty("winnerId", out var winnerId) &&
                winnerId.ValueKind == System.Text.Json.JsonValueKind.Number &&
                winnerId.TryGetInt32(out var w) &&
                w > 0)
            {
                return "finished";
            }

            if (meta.TryGetProperty("outcomesByPlayerId", out var outcomes) &&
                outcomes.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                return "finished";
            }
        }
        catch
        {
            // ignore
        }

        return status;
    }

    private static bool IsStartReadyFromState(GameStateDto state)
    {
        if (!string.Equals(state.Status, "started", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        try
        {
            var metadata = state.Metadata;
            if (metadata.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (!metadata.TryGetProperty("lifecycle", out var lifecycle) ||
                lifecycle.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (!lifecycle.TryGetProperty("startReady", out var ready))
            {
                return false;
            }

            if (ready.ValueKind == System.Text.Json.JsonValueKind.True)
            {
                return true;
            }

            if (ready.ValueKind == System.Text.Json.JsonValueKind.False)
            {
                return false;
            }
        }
        catch
        {
            // ignore
        }

        return false;
    }

    private static bool HasStartReadyFlag(GameStateDto state)
    {
        if (!string.Equals(state.Status, "started", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        try
        {
            var metadata = state.Metadata;
            if (metadata.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (!metadata.TryGetProperty("lifecycle", out var lifecycle) ||
                lifecycle.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            return lifecycle.TryGetProperty("startReady", out _);
        }
        catch
        {
            return false;
        }
    }

    private static bool IsViewerTurnActionableFromState(GameStateDto state)
    {
        return ReadLifecycleBoolean(state, "viewerTurnActionable");
    }

    private static bool IsViewerMustChoosePawnFromState(GameStateDto state)
    {
        return ReadLifecycleBoolean(state, "viewerMustChoosePawn");
    }

    private static bool ReadLifecycleBoolean(GameStateDto state, string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return false;
        }

        try
        {
            var metadata = state.Metadata;
            if (metadata.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (!metadata.TryGetProperty("lifecycle", out var lifecycle) ||
                lifecycle.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (!lifecycle.TryGetProperty(key, out var value))
            {
                return false;
            }

            return value.ValueKind == System.Text.Json.JsonValueKind.True;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsEndgameLogMessage(string message)
    {
        var msg = (message ?? string.Empty).Trim();
        if (msg.Length == 0)
        {
            return false;
        }

        return msg.StartsWith("Partie terminée", StringComparison.OrdinalIgnoreCase) ||
               msg.StartsWith("Match nul", StringComparison.OrdinalIgnoreCase) ||
               msg.StartsWith("Fin de la manche", StringComparison.OrdinalIgnoreCase) ||
               msg.StartsWith("Victoire de", StringComparison.OrdinalIgnoreCase) ||
               msg.StartsWith("Défaite de", StringComparison.OrdinalIgnoreCase) ||
               msg.StartsWith("Defaite de", StringComparison.OrdinalIgnoreCase) ||
               msg.StartsWith("Gagnant :", StringComparison.OrdinalIgnoreCase) ||
               msg.StartsWith("Gagnants :", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasOutcomeData(GameStateDto state)
    {
        return GamePlayWinnerReader.TryExtractWinnerPlayerId(state) != null ||
               GamePlayWinnerReader.TryExtractOutcomeMap(state).Count > 0;
    }

    private void TryAnnounceTurnFromState(GameStateDto state, bool force = false)
    {
        if (!string.Equals(state.Status, "started", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        // Pawn selection is a setup phase; avoid announcing "C'est au tour de X." before the game actually starts.
        // The server already prompts with "C'est à X de choisir un pion." during this phase.
        if (PawnPendingTypes.IsPawnPendingType(state.Pending?.Type))
        {
            return;
        }

        var currentPlayerId = state.Turn?.CurrentPlayerId;
        if (currentPlayerId == null)
        {
            return;
        }

        if (!force && _lastStateTurnPlayerId == currentPlayerId)
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
            emitHistoryMessage: msg => _emitMessage(new GamePlayHistoryMessage(msg)));
    }

    private void TryEmitGenericEndgameSummary(GameStateDto state)
    {
        if (state == null)
        {
            return;
        }

        var players = (state.Players ?? new List<GamePlayerDto>())
            .Where(p => p != null && p.Id > 0)
            .ToList();

        var winnerId = GamePlayWinnerReader.TryExtractWinnerPlayerId(state);
        if (winnerId != null && players.Count > 0)
        {
            var winnerName = GetPlayerName(players, winnerId.Value);
            if (!string.IsNullOrWhiteSpace(winnerName))
            {
                _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
                _emitMessage(new GamePlayHistoryMessage($"Victoire écrasante de {winnerName}!"));
                return;
            }
        }

        if (TryReadOutcomesByPlayerId(state, out var outcomes) && outcomes.Count > 0)
        {
            var winners = new List<string>();
            var hasDraw = false;
            foreach (var p in players)
            {
                if (!outcomes.TryGetValue(p.Id, out var outcome))
                {
                    continue;
                }

                var name = (p.Username ?? string.Empty).Trim();
                if (name.Length == 0)
                {
                    continue;
                }

                if (string.Equals(outcome, "won", StringComparison.OrdinalIgnoreCase))
                {
                    winners.Add(name);
                }
                else if (string.Equals(outcome, "draw", StringComparison.OrdinalIgnoreCase))
                {
                    hasDraw = true;
                }
            }

            if (winners.Count > 0)
            {
                _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
                _emitMessage(new GamePlayHistoryMessage($"Victoire écrasante de {string.Join(", ", winners)}!"));
                return;
            }

            if (hasDraw)
            {
                _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
                _emitMessage(new GamePlayHistoryMessage("Match nul."));
                return;
            }
        }

        if (!string.IsNullOrWhiteSpace(_lastEndgameWinnerNameFromLog))
        {
            _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
            _emitMessage(new GamePlayHistoryMessage($"Victoire écrasante de {_lastEndgameWinnerNameFromLog}!"));
            return;
        }
        if (_lastEndgameDrawFromLog)
        {
            _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
            _emitMessage(new GamePlayHistoryMessage("Match nul."));
            return;
        }

        _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
    }

    private static string GetPlayerName(IReadOnlyList<GamePlayerDto> players, int playerId)
    {
        return players
            .FirstOrDefault(p => p.Id == playerId)?
            .Username?
            .Trim() ?? string.Empty;
    }

    private void TryEmitGenericEndgameSummary(GameEndedDto ended)
    {
        if (ended == null)
        {
            return;
        }

        var winners = new List<string>();
        var hasDraw = false;
        var outcomes = ended.OutcomesByPlayerId ?? new Dictionary<string, string>();
        var playersById = ended.PlayersById ?? new Dictionary<string, string>();

        foreach (var (playerId, outcomeRaw) in outcomes)
        {
            var outcome = (outcomeRaw ?? string.Empty).Trim();
            if (outcome.Length == 0)
            {
                continue;
            }

            var name = playersById.TryGetValue(playerId, out var n)
                ? (n ?? string.Empty).Trim()
                : string.Empty;
            if (name.Length == 0)
            {
                name = $"Joueur {playerId}";
            }

            if (string.Equals(outcome, "won", StringComparison.OrdinalIgnoreCase))
            {
                winners.Add(name);
            }
            else if (string.Equals(outcome, "draw", StringComparison.OrdinalIgnoreCase))
            {
                hasDraw = true;
            }
        }

        if (winners.Count > 0)
        {
            _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
            _emitMessage(new GamePlayHistoryMessage($"Victoire écrasante de {string.Join(", ", winners)}!"));
            return;
        }

        if (hasDraw)
        {
            _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
            _emitMessage(new GamePlayHistoryMessage("Match nul."));
            return;
        }

        if (ended.WinnerPlayerId != null && ended.WinnerPlayerId.Value > 0)
        {
            var key = ended.WinnerPlayerId.Value.ToString();
            var winnerName = playersById.TryGetValue(key, out var n)
                ? (n ?? string.Empty).Trim()
                : string.Empty;
            if (winnerName.Length == 0)
            {
                winnerName = $"Joueur {ended.WinnerPlayerId.Value}";
            }
            _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
            _emitMessage(new GamePlayHistoryMessage($"Victoire écrasante de {winnerName}!"));
            return;
        }

        if (!string.IsNullOrWhiteSpace(_lastEndgameWinnerNameFromLog))
        {
            _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
            _emitMessage(new GamePlayHistoryMessage($"Victoire écrasante de {_lastEndgameWinnerNameFromLog}!"));
            return;
        }
        if (_lastEndgameDrawFromLog)
        {
            _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
            _emitMessage(new GamePlayHistoryMessage("Match nul."));
            return;
        }

        _emitMessage(new GamePlayHistoryMessage("Fin de la partie."));
    }

    private void TryEmitPublicEndgameMessages(GameEndedDto ended)
    {
        if (ended == null)
        {
            return;
        }

        var emittedViewer = false;
        var map = ended.PublicEndgameMessagesByPlayerId ?? new Dictionary<string, string>();
        foreach (var (playerIdRaw, rawMessage) in map.OrderBy(kv => kv.Key, StringComparer.Ordinal))
        {
            if (!int.TryParse(playerIdRaw, out var playerId) || playerId <= 0)
            {
                continue;
            }

            var message = (rawMessage ?? string.Empty).Trim();
            if (message.Length == 0)
            {
                continue;
            }

            var name = ended.PlayersById != null && ended.PlayersById.TryGetValue(playerIdRaw, out var n)
                ? (n ?? string.Empty).Trim()
                : string.Empty;
            if (name.Length == 0)
            {
                name = $"Joueur {playerId}";
            }

            var line = $"{name} dit: {message}";
            if (!WasRecentlyEmitted(line))
            {
                TrackRecentHistoryLine(line);
                _emitMessage(new GamePlayHistoryMessage(line));
            }
            if (ended.ViewerPlayerId != null && ended.ViewerPlayerId.Value == playerId)
            {
                emittedViewer = true;
            }
        }

        // Backward compatibility with servers that only send viewerEndgameMessage.
        var viewerMessage = (ended.ViewerEndgameMessage ?? string.Empty).Trim();
        if (viewerMessage.Length == 0 || emittedViewer)
        {
            return;
        }

        var viewerId = ended.ViewerPlayerId;
        var viewerName = string.Empty;
        if (viewerId != null && viewerId.Value > 0)
        {
            var key = viewerId.Value.ToString();
            if (ended.PlayersById != null && ended.PlayersById.TryGetValue(key, out var n))
            {
                viewerName = (n ?? string.Empty).Trim();
            }
            if (viewerName.Length == 0)
            {
                viewerName = $"Joueur {viewerId.Value}";
            }
        }

        var viewerLine = viewerName.Length > 0
            ? $"{viewerName} dit: {viewerMessage}"
            : viewerMessage;
        if (!WasRecentlyEmitted(viewerLine))
        {
            TrackRecentHistoryLine(viewerLine);
            _emitMessage(new GamePlayHistoryMessage(viewerLine));
        }
    }

    private static bool TryReadOutcomesByPlayerId(GameStateDto state, out Dictionary<int, string> outcomes)
    {
        outcomes = new Dictionary<int, string>();
        return TryReadOutcomesByPlayerId(state.Metadata, outcomes) || TryReadOutcomesByPlayerId(state.Extras, outcomes);
    }

    private static bool TryReadOutcomesByPlayerId(System.Text.Json.JsonElement source, Dictionary<int, string> target)
    {
        if (source.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            return false;
        }

        if (!source.TryGetProperty("outcomesByPlayerId", out var outcomes) ||
            outcomes.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            return false;
        }

        foreach (var prop in outcomes.EnumerateObject())
        {
            if (!int.TryParse(prop.Name, out var playerId) || playerId <= 0)
            {
                continue;
            }
            if (prop.Value.ValueKind != System.Text.Json.JsonValueKind.String)
            {
                continue;
            }

            var value = (prop.Value.GetString() ?? string.Empty).Trim();
            if (value.Length == 0)
            {
                continue;
            }

            target[playerId] = value;
        }

        return target.Count > 0;
    }

    private static string? GetUsername(GameStateDto state, int? playerId)
    {
        if (state == null || playerId == null)
        {
            return null;
        }

        return state.Players?
            .FirstOrDefault(p => p != null && p.Id == playerId.Value)?
            .Username?
            .Trim();
    }

    private static Dictionary<string, int> BuildHandCounts(IReadOnlyList<string> labels)
    {
        var dict = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (labels == null)
        {
            return dict;
        }

        foreach (var raw in labels)
        {
            var s = (raw ?? string.Empty).Trim();
            if (s.Length == 0)
            {
                continue;
            }

            dict.TryGetValue(s, out var prev);
            dict[s] = prev + 1;
        }

        return dict;
    }

}
