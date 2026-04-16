using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Choices.Services;

internal static class DiscardChoiceBuilder
{
    internal static bool HasDiscardChoices(GameStateDto? state)
    {
        // If the server exposes a pending (including synthetic pending from the engine),
        // do not offer client-side discard selection.
        if (state?.Pending != null)
        {
            return false;
        }

        if (state?.Actions == null || state.Actions.Count == 0)
        {
            return false;
        }

        return state.Actions.Any(a => string.Equals(a.Type, "discard_card", StringComparison.OrdinalIgnoreCase));
    }

    internal static bool ShouldAutoOfferDiscardSelection(GameStateDto state, bool drawAvailable)
    {
        if (state.Pending != null)
        {
            return false;
        }

        return HasDiscardChoices(state) && !drawAvailable;
    }

    internal static bool TryBuildDiscardChoices(GameStateDto state, out Dictionary<string, GameClientAction> choices)
    {
        choices = new Dictionary<string, GameClientAction>(StringComparer.Ordinal);

        try
        {
            var actions = state.Actions ?? new List<GameAvailableActionDto>();
            if (actions.Count == 0)
            {
                return false;
            }

            var labelByCardKey = BuildHandCardLabelIndex(state);

            foreach (var action in actions.Where(a => string.Equals(a.Type, "discard_card", StringComparison.OrdinalIgnoreCase)))
            {
                var payload = action.Payload;
                if (payload.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var memberId = payload.TryGetProperty("memberId", out var m) && m.ValueKind == JsonValueKind.String
                    ? m.GetString()
                    : null;
                if (string.IsNullOrWhiteSpace(memberId))
                {
                    continue;
                }

                var familyId = payload.TryGetProperty("familyId", out var f) && f.ValueKind == JsonValueKind.String
                    ? f.GetString()
                    : null;

                var cardKey = $"{familyId ?? string.Empty}|{memberId}";
                var label = labelByCardKey.TryGetValue(cardKey, out var l)
                    ? l
                    : memberId.Trim();

                var key = ChoiceLabelUniquifier.MakeUniqueChoiceLabel(choices, label);
                choices[key] = familyId == null
                    ? new GameClientAction("discard_card", payload: new { memberId = memberId.Trim() })
                    : new GameClientAction("discard_card", payload: new { memberId = memberId.Trim(), familyId = familyId.Trim() });
            }

            return choices.Count > 0;
        }
        catch
        {
            choices.Clear();
            return false;
        }
    }

    private static Dictionary<string, string> BuildHandCardLabelIndex(GameStateDto state)
    {
        var index = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (state.Extras.ValueKind != JsonValueKind.Object)
        {
            return index;
        }

        if (!state.Extras.TryGetProperty("handCards", out var cards) || cards.ValueKind != JsonValueKind.Array)
        {
            return index;
        }

        foreach (var card in cards.EnumerateArray())
        {
            if (card.ValueKind != JsonValueKind.Object) continue;
            var familyId = card.TryGetProperty("familyId", out var f) && f.ValueKind == JsonValueKind.String ? f.GetString() : null;
            var memberId = card.TryGetProperty("memberId", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null;
            var label = card.TryGetProperty("label", out var l) && l.ValueKind == JsonValueKind.String ? l.GetString() : null;

            if (string.IsNullOrWhiteSpace(memberId) || string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            var key = $"{(familyId ?? string.Empty).Trim()}|{memberId.Trim()}";
            if (!index.ContainsKey(key))
            {
                index[key] = label.Trim();
            }
        }

        return index;
    }
}
