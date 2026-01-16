using System;
using System.Collections.Generic;
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
    private Dictionary<string, int>? _lastViewerHandCounts;

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
        _lastViewerHandCounts = null;
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
                _announcementRouter.TryHandleTurnUpdate(info, _emitMessage, force: true);
            }
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
            var viewerId = GamePlayExtrasParser.ExtractViewerPlayerId(state);
            var viewerUsername = GetUsername(state, viewerId);
            var currentHandCounts = BuildHandCounts(GamePlayExtrasParser.ExtractViewerHandLabels(state));

            // IMPORTANT:
            // Annoncer d'abord les nouvelles lignes d'historique (ordre serveur),
            // puis seulement ensuite appliquer les changements d'interface (ex: liste de choix),
            // sinon NVDA lit le contrôle (ex: "Échange") avant le message "Case 11: Échange ...".
            foreach (var msg in presented.newLogMessages)
            {
                _emitMessage(RewriteLogForViewer(msg, viewerUsername, _lastViewerHandCounts, currentHandCounts));
            }

            var nextStatus = NormalizeStatus(state);
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

            _viewerPlayerId = viewerId;
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

            _lastViewerHandCounts = currentHandCounts;
            _refreshCanExecute();
            TryAnnounceTurnFromState(state);
        }, DispatcherPriority.Background);
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

        var user = viewerUsername.Trim();

        // Pioche : ne révèle la carte piochée qu'au joueur concerné.
        if (string.Equals(msg, $"{user} pioche.", StringComparison.OrdinalIgnoreCase))
        {
            var added = InferSingleAddedCard(previousHandCounts, currentHandCounts);
            return added != null ? $"Vous piochez un {added}." : "Vous piochez.";
        }

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
