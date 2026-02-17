using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Choices.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Choices.ViewModels;

internal sealed class GamePlayChoicesStateSynchronizer
{
    private readonly GamePlayLocalChoices _localChoices;
    private readonly GamePlayChoicesListController _list;

    internal GamePlayChoicesStateSynchronizer(GamePlayLocalChoices localChoices, GamePlayChoicesListController list)
    {
        _localChoices = localChoices ?? throw new ArgumentNullException(nameof(localChoices));
        _list = list ?? throw new ArgumentNullException(nameof(list));
    }

    internal void UpdateFromState(
        GameStateDto state,
        int? viewerPlayerId,
        Func<GameStateDto, bool> canStartAskCardSelection,
        Action<string> setLabel)
    {
        if (state == null) return;

        if (ShouldHidePendingChoices(state, viewerPlayerId))
        {
            _localChoices.Clear();
            setLabel(string.Empty);
            _list.Clear();
            return;
        }

        var serverChoices = PendingChoicesReader.ExtractServerPendingChoices(state);
        var hasServerPendingChoices = serverChoices.Count > 0;

        if (hasServerPendingChoices)
        {
            _localChoices.Clear();
            setLabel(PendingChoicesReader.BuildServerChoicesLabel(state.Pending));
            var type = (state.Pending?.Type ?? string.Empty).Trim();
            var isQuiz = string.Equals(type, "quiz", StringComparison.OrdinalIgnoreCase);
            _list.Apply(serverChoices, autoSelectFirst: !isQuiz);
            return;
        }

        if (TryBuildChoosePawnFallbackChoices(state, out var pawnChoices))
        {
            ApplyLocalChoices("choose_pawn_fallback", pawnChoices, setLabel);
            var pendingLabel = PendingChoicesReader.BuildServerChoicesLabel(state.Pending);
            setLabel(string.IsNullOrWhiteSpace(pendingLabel) ? "Choisissez votre pion." : pendingLabel);
            return;
        }

        if (_localChoices.IsMode("ask") &&
            _localChoices.HasChoices &&
            canStartAskCardSelection(state))
        {
            return;
        }

        if (GamePlayChoiceBuilder.ShouldAutoOfferDiscardSelection(state, drawAvailable: HasAction(state, "draw")) &&
            GamePlayChoiceBuilder.TryBuildDiscardChoices(state, out var discardChoices))
        {
            ApplyLocalChoices("discard_auto", discardChoices, setLabel);
            return;
        }

        _localChoices.Clear();
        setLabel(string.Empty);
        _list.Clear();
    }

    internal bool TryStartDiscardSelection(GameStateDto state, Action<string> announce, Action<string> setLabel)
    {
        if (state == null) return false;
        if (!GamePlayChoiceBuilder.TryBuildDiscardChoices(state, out var choices))
        {
            return false;
        }

        ApplyLocalChoices("discard", choices, setLabel);
        var label = "Choisissez une carte à défausser dans la liste, puis Entrée.";
        setLabel(label);
        announce(label);
        return true;
    }

    internal bool TryStartAskSelection(GameStateDto state, Action<string> announce, Action<string> setLabel)
    {
        if (state == null) return false;
        if (!GamePlayChoiceBuilder.TryBuildAskCardChoices(state, out var choices))
        {
            return false;
        }

        ApplyLocalChoices("ask", choices, setLabel);
        var label = "Choisissez une demande dans la liste, puis Entrée.";
        setLabel(label);
        announce(label);
        return true;
    }

    internal void ClearAllChoices(Action<string> setLabel)
    {
        _localChoices.Clear();
        setLabel(string.Empty);
        _list.Clear();
    }

    private static bool ShouldHidePendingChoices(GameStateDto state, int? viewerPlayerId)
    {
        var pendingPlayerId = state.Pending?.PlayerId;
        var pendingType = (state.Pending?.Type ?? string.Empty).Trim();
        var isQuiz = string.Equals(pendingType, "quiz", StringComparison.OrdinalIgnoreCase);
        var canAnswerQuiz = !isQuiz || HasAction(state, "answer_quiz");
        // Si le viewer est inconnu (serveur ancien / payload incomplet), on masque les choix de quiz
        // sauf si on détecte une action de réponse (joueur actif).
        if (viewerPlayerId == null)
        {
            return isQuiz && !canAnswerQuiz;
        }

        if (pendingPlayerId != null &&
            viewerPlayerId != null &&
            pendingPlayerId.Value != viewerPlayerId.Value)
        {
            return true;
        }

        if (isQuiz && !canAnswerQuiz)
        {
            return true;
        }

        return false;
    }

    private void ApplyLocalChoices(string mode, Dictionary<string, GameClientAction> choices, Action<string> setLabel)
    {
        _localChoices.Set(mode, choices);
        setLabel(string.Empty);
        _list.Apply(choices.Keys.ToList());
    }

    private static bool HasAction(GameStateDto state, string actionType)
    {
        if (string.IsNullOrWhiteSpace(actionType))
        {
            return false;
        }

        var actions = state.Actions;
        if (actions == null || actions.Count == 0)
        {
            return false;
        }

        return actions.Any(a => string.Equals(a.Type, actionType, StringComparison.OrdinalIgnoreCase));
    }

    private static bool TryBuildChoosePawnFallbackChoices(
        GameStateDto state,
        out Dictionary<string, GameClientAction> choices)
    {
        choices = new Dictionary<string, GameClientAction>(StringComparer.Ordinal);

        var pendingType = (state.Pending?.Type ?? string.Empty).Trim();
        if (!string.Equals(pendingType, "choose_pawn", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if ((state.Pending?.Choices?.Count ?? 0) > 0)
        {
            return false;
        }

        if (state.Pending?.Data.ValueKind == JsonValueKind.Object &&
            state.Pending.Data.TryGetProperty("pawns", out var pawnsNode) &&
            pawnsNode.ValueKind == JsonValueKind.Array)
        {
            foreach (var pawn in pawnsNode.EnumerateArray())
            {
                if (pawn.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var pawnId = TryReadPayloadString(pawn, "id")
                             ?? TryReadPayloadString(pawn, "pawnId")
                             ?? TryReadPayloadString(pawn, "value");
                var pawnLabel = TryReadPayloadString(pawn, "label");
                if (string.IsNullOrWhiteSpace(pawnId))
                {
                    continue;
                }

                pawnId = pawnId.Trim();
                var label = !string.IsNullOrWhiteSpace(pawnLabel)
                    ? pawnLabel.Trim()
                    : pawnId;
                var key = ChoiceLabelUniquifier.MakeUniqueChoiceLabel(choices, label);
                choices[key] = new GameClientAction("choose_pawn", new { pawnId });
            }
        }

        if (choices.Count > 0)
        {
            return true;
        }

        var actions = state.Actions ?? new List<GameAvailableActionDto>();
        if (actions.Count == 0)
        {
            return false;
        }

        foreach (var action in actions.Where(a => string.Equals(a.Type, "choose_pawn", StringComparison.OrdinalIgnoreCase)))
        {
            if (action.Payload.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var pawnId = TryReadPayloadString(action.Payload, "pawnId")
                         ?? TryReadPayloadString(action.Payload, "pawn")
                         ?? TryReadPayloadString(action.Payload, "value");
            if (string.IsNullOrWhiteSpace(pawnId))
            {
                continue;
            }
            pawnId = pawnId.Trim();

            var key = ChoiceLabelUniquifier.MakeUniqueChoiceLabel(choices, pawnId);
            choices[key] = new GameClientAction(action.Type, new { pawnId });
        }

        return choices.Count > 0;
    }

    private static string? TryReadPayloadString(JsonElement payload, string propertyName)
    {
        if (!payload.TryGetProperty(propertyName, out var node))
        {
            return null;
        }

        if (node.ValueKind == JsonValueKind.String)
        {
            return node.GetString();
        }

        if (node.ValueKind == JsonValueKind.Number)
        {
            if (node.TryGetInt32(out var asInt))
            {
                return asInt.ToString();
            }
            if (node.TryGetDouble(out var asDouble) && double.IsFinite(asDouble))
            {
                return asDouble.ToString(System.Globalization.CultureInfo.InvariantCulture);
            }
        }

        return null;
    }
}
