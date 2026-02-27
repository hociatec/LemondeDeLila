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
    private bool _lastBotThinking;
    private bool _endgameFeedbackEmitted;
    private bool _finishedStatusEnforced;
    private bool _lastStartReady;
    private bool _lastViewerTurnActionable;
    private bool _lastViewerMustChoosePawn;
    private int _pendingForcedTurnAnnouncements;
    private Dictionary<string, int>? _lastViewerHandCounts;
    private string? _lastDrawActionToken;
    private readonly object _statePumpLock = new();
    private readonly List<GameStateDto> _pendingStates = new();
    private int _statePumpRunning;

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
        _lastBotThinking = false;
        _endgameFeedbackEmitted = false;
        _finishedStatusEnforced = false;
        _lastStartReady = false;
        _lastViewerTurnActionable = false;
        _lastViewerMustChoosePawn = false;
        _lastViewerHandCounts = null;
        lock (_statePumpLock)
        {
            _pendingStates.Clear();
        }
        Interlocked.Exchange(ref _statePumpRunning, 0);
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
            // Évite le spam : les tours sont déjà annoncés via l'historique serveur.
            // Garder seulement les annonces "forcées" (ex: demande manuelle de game.turn).
            if (force)
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
            if (!_endgameFeedbackEmitted)
            {
                if (ended.ViewerPlayerId != null && ended.ViewerPlayerId.Value > 0)
                {
                    _viewerPlayerId = ended.ViewerPlayerId.Value;
                }

                _endgameFeedbackEmitted = true;
                _endgameSounds.TryPlayEndgameSound(ended, _viewerPlayerId);
                TryEmitGenericEndgameSummary(ended);
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
        var previousBotThinking = _lastBotThinking;
        var currentHandCounts = BuildHandCounts(GamePlayExtrasParser.ExtractViewerHandLabels(state));
        var hasEndgameLogEntry = false;

        foreach (var entry in presented.newLogMessages)
        {
            var trimmed = entry?.Message ?? string.Empty;
            _logSounds.TryPlayForLogMessage(trimmed, viewerUsername);
            if (IsEndgameLogMessage(trimmed))
            {
                hasEndgameLogEntry = true;
            }
            var rewritten = RewriteLogForViewer(trimmed, viewerUsername, _lastViewerHandCounts, currentHandCounts);
            _emitMessage(new GamePlayHistoryMessage(rewritten, entry?.Timestamp));
        }

        var nextStatus = NormalizeStatus(state);
        var nextPhase = (state.Phase ?? string.Empty).Trim();
        var previousStatus = _lastGameStatus ?? string.Empty;
        var previousPhase = _lastGamePhase ?? string.Empty;
        var previousStartReady = _lastStartReady;
        var previousViewerTurnActionable = _lastViewerTurnActionable;
        var previousViewerMustChoosePawn = _lastViewerMustChoosePawn;
        _lastGameStatus = nextStatus;
        _lastGamePhase = nextPhase;
        var startReady = IsStartReadyFromState(state);
        var viewerTurnActionable = IsViewerTurnActionableFromState(state);
        var viewerMustChoosePawn = IsViewerMustChoosePawnFromState(state);
        _lastStartReady = startReady;
        _lastViewerTurnActionable = viewerTurnActionable;
        _lastViewerMustChoosePawn = viewerMustChoosePawn;
        if (!string.Equals(previousStatus, nextStatus, StringComparison.OrdinalIgnoreCase))
        {
            _onGameStatusChanged(previousStatus, nextStatus);
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
            _finishedStatusEnforced = false;
            // During pawn selection setup, the pending label is the authoritative prompt.
            // Avoid adding a redundant "C'est au tour de ...".
            if (!PawnPendingTypes.IsPawnPendingType(state.Pending?.Type))
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
        if (viewerMustChoosePawn && !previousViewerMustChoosePawn)
        {
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
        var endedFromLog = leftStarted && hasEndgameLogEntry;
        if (!_endgameFeedbackEmitted && (becameFinished || endedWithOutcomeData || endedFromLog))
        {
            _endgameFeedbackEmitted = true;
            _endgameSounds.TryPlayEndgameSound(state, viewerId);
            TryEmitGenericEndgameSummary(state);
        }

        _setIsBotThinking(presented.isBotThinking);
        _setStateSummary(presented.stateSummary);
        _setPendingText(presented.pendingText);
        _setActionsText(presented.actionsText);
        _setBoardText(GamePlayBoardTextBuilder.Build(state));

        TryPlayDrawSoundFromState(state);

        _syncShortcuts(state);
        _grid.SyncFromState(state, _viewerPlayerId);

        _lastPendingType = PawnPendingTypes.Normalize(state.Pending?.Type);
        _lastBotThinking = state.BotThinking;
        _lastViewerHandCounts = currentHandCounts;
        _refreshCanExecute();
        TryAnnounceTurnFromState(state);
    }

    private void TryPlayDrawSoundFromState(GameStateDto state)
    {
        if (state == null) return;
        var draw = state.LastDraw;
        if (draw == null) return;
        var token = $"draw|{draw.At}|{draw.PlayerId}";
        if (string.Equals(_lastDrawActionToken, token, StringComparison.Ordinal))
        {
            return;
        }
        _lastDrawActionToken = token;
        _logSounds.TryPlayDrawSound();
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
               msg.StartsWith("Gagnant :", StringComparison.OrdinalIgnoreCase) ||
               msg.StartsWith("Gagnants :", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasOutcomeData(GameStateDto state)
    {
        return GamePlayWinnerReader.TryExtractWinnerPlayerId(state) != null ||
               GamePlayWinnerReader.TryExtractOutcomeMap(state).Count > 0;
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
            var loserNames = players
                .Where(p => p.Id != winnerId.Value)
                .Select(p => (p.Username ?? string.Empty).Trim())
                .Where(n => n.Length > 0)
                .ToList();

            if (!string.IsNullOrWhiteSpace(winnerName))
            {
                if (loserNames.Count > 0)
                {
                    _emitMessage(
                        new GamePlayHistoryMessage(
                            $"Partie terminée. Gagnant: {winnerName}. Perdants: {string.Join(", ", loserNames)}."));
                }
                else
                {
                    _emitMessage(new GamePlayHistoryMessage($"Partie terminée. Gagnant: {winnerName}."));
                }
                return;
            }
        }

        if (TryReadOutcomesByPlayerId(state, out var outcomes) && outcomes.Count > 0)
        {
            var winners = new List<string>();
            var losers = new List<string>();
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
                else if (string.Equals(outcome, "lost", StringComparison.OrdinalIgnoreCase))
                {
                    losers.Add(name);
                }
            }

            if (winners.Count > 0 || losers.Count > 0)
            {
                var winnerPart = winners.Count > 0 ? $"Gagnant(s): {string.Join(", ", winners)}." : string.Empty;
                var loserPart = losers.Count > 0 ? $" Perdant(s): {string.Join(", ", losers)}." : string.Empty;
                _emitMessage(new GamePlayHistoryMessage($"Partie terminée. {winnerPart}{loserPart}".Trim()));
                return;
            }
        }

        _emitMessage(new GamePlayHistoryMessage("Partie terminée."));
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
        var losers = new List<string>();
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
            else if (string.Equals(outcome, "lost", StringComparison.OrdinalIgnoreCase))
            {
                losers.Add(name);
            }
        }

        if (winners.Count > 0 || losers.Count > 0)
        {
            var winnerPart = winners.Count > 0 ? $"Gagnant(s): {string.Join(", ", winners)}." : string.Empty;
            var loserPart = losers.Count > 0 ? $" Perdant(s): {string.Join(", ", losers)}." : string.Empty;
            _emitMessage(new GamePlayHistoryMessage($"Partie terminée. {winnerPart}{loserPart}".Trim()));
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
            _emitMessage(new GamePlayHistoryMessage($"Partie terminée. Gagnant: {winnerName}."));
            return;
        }

        _emitMessage(new GamePlayHistoryMessage("Partie terminée."));
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

    private static string? InferSingleAddedCard(Dictionary<string, int>? previous, Dictionary<string, int>? current)
    {
        if (previous == null || current == null || current.Count == 0)
        {
            return null;
        }

        string? added = null;
        foreach (var (label, currentCount) in current)
        {
            previous.TryGetValue(label, out var prevCount);
            var diff = currentCount - prevCount;
            if (diff <= 0)
            {
                continue;
            }
            if (diff > 1)
            {
                return null;
            }
            if (added != null)
            {
                return null;
            }
            added = label;
        }

        return added;
    }

    private static string RewriteLogForViewer(
        string message,
        string? viewerUsername,
        Dictionary<string, int>? previousHandCounts,
        Dictionary<string, int>? currentHandCounts)
    {
        var msg = (message ?? string.Empty).Trim();
        if (msg.Length == 0 || string.IsNullOrWhiteSpace(viewerUsername))
        {
            return msg;
        }

        var viewerName = viewerUsername.Trim();
        const string drawMarker = " pioche";
        var drawIndex = msg.IndexOf(drawMarker, StringComparison.OrdinalIgnoreCase);
        if (drawIndex > 0)
        {
            var actor = msg.Substring(0, drawIndex).Trim();
            if (!string.IsNullOrWhiteSpace(actor))
            {
                if (string.Equals(actor, viewerName, StringComparison.OrdinalIgnoreCase))
                {
                    if (string.Equals(msg, $"{actor} pioche.", StringComparison.OrdinalIgnoreCase))
                    {
                        var added = InferSingleAddedCard(previousHandCounts, currentHandCounts);
                        return added != null ? $"Vous piochez un {added}." : "Vous piochez.";
                    }

                    // If the server includes the drawn card label (ex: "Alice pioche un 5."),
                    // keep it for the local player.
                    var remainder = msg.Substring(drawIndex + drawMarker.Length).Trim();
                    if (string.IsNullOrWhiteSpace(remainder) || string.Equals(remainder, ".", StringComparison.Ordinal))
                    {
                        return "Vous piochez.";
                    }
                    return $"Vous piochez {remainder}";
                }
                return msg;
            }
        }

        var user = viewerName;

        if (string.Equals(msg, $"{user} passe.", StringComparison.OrdinalIgnoreCase))
        {
            return "Vous passez.";
        }

        if (msg.StartsWith($"{user} se retire de la manche", StringComparison.OrdinalIgnoreCase))
        {
            return "Vous vous retirez de la manche. Vos jetons seront comptés à la fin de la manche.";
        }

        if (string.Equals(msg, $"{user} ne rend rien.", StringComparison.OrdinalIgnoreCase))
        {
            return "Vous ne rendez rien.";
        }

        var renderPrefix = $"{user} rend ";
        if (msg.StartsWith(renderPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return $"Vous rendez {msg.Substring(renderPrefix.Length).Trim()}";
        }

        // Jeu de carte : annonce toujours la carte, en adaptant la formulation pour le joueur local.
        // Exemple serveur: "Fantômette joue un 1."
        var prefix = $"{user} joue un ";
        if (msg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            var card = msg.Substring(prefix.Length).Trim();
            return $"Vous jouez un {card}";
        }

        return msg;
    }
}



