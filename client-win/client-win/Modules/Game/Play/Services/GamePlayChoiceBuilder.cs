using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.Services;

internal static class GamePlayChoiceBuilder
{
    internal static bool HasDiscardChoices(GameStateDto? state)
    {
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

                var key = MakeUniqueChoiceLabel(choices, label);
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

    internal static bool TryBuildAskCardChoices(GameStateDto state, out Dictionary<string, GameClientAction> choices)
    {
        choices = new Dictionary<string, GameClientAction>(StringComparer.Ordinal);

        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (!state.Extras.TryGetProperty("catalog", out var catalog) || catalog.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (!state.Extras.TryGetProperty("playerViews", out var playerViews) || playerViews.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            if (!state.Extras.TryGetProperty("handCards", out var handCards) || handCards.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            var actorId = state.Turn?.CurrentPlayerId;
            if (actorId == null)
            {
                return false;
            }

            var targets = new List<(int id, string username)>();
            foreach (var p in playerViews.EnumerateArray())
            {
                if (p.ValueKind != JsonValueKind.Object) continue;
                var id = p.TryGetProperty("id", out var idNode) && idNode.TryGetInt32(out var asInt) ? asInt : (int?)null;
                var username = p.TryGetProperty("username", out var u) && u.ValueKind == JsonValueKind.String ? u.GetString() : null;
                if (id == null || id.Value == actorId.Value) continue;
                if (string.IsNullOrWhiteSpace(username)) continue;
                targets.Add((id.Value, username.Trim()));
            }

            if (targets.Count == 0)
            {
                return false;
            }

            var inHandMemberIdsByFamily = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            var familyNameById = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            foreach (var card in handCards.EnumerateArray())
            {
                if (card.ValueKind != JsonValueKind.Object) continue;
                var familyId = card.TryGetProperty("familyId", out var f) && f.ValueKind == JsonValueKind.String ? f.GetString() : null;
                var memberId = card.TryGetProperty("memberId", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null;
                var label = card.TryGetProperty("label", out var l) && l.ValueKind == JsonValueKind.String ? l.GetString() : null;
                if (string.IsNullOrWhiteSpace(familyId) || string.IsNullOrWhiteSpace(memberId)) continue;

                var fid = familyId.Trim();
                var mid = memberId.Trim();
                if (!inHandMemberIdsByFamily.TryGetValue(fid, out var set))
                {
                    set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    inHandMemberIdsByFamily[fid] = set;
                }
                set.Add(mid);

                if (!string.IsNullOrWhiteSpace(label) && !familyNameById.ContainsKey(fid))
                {
                    var raw = label.Trim();
                    var idx = raw.IndexOf(" - ", StringComparison.Ordinal);
                    if (idx > 0)
                    {
                        familyNameById[fid] = raw.Substring(0, idx).Trim();
                    }
                }
            }

            if (inHandMemberIdsByFamily.Count == 0)
            {
                return false;
            }

            foreach (var family in inHandMemberIdsByFamily)
            {
                var familyId = family.Key;
                var owned = family.Value;
                var familyName = familyNameById.TryGetValue(familyId, out var fn) ? fn : familyId;

                if (!catalog.TryGetProperty(familyId, out var members) || members.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var member in members.EnumerateArray())
                {
                    if (member.ValueKind != JsonValueKind.Object) continue;
                    var memberId = member.TryGetProperty("id", out var idNode) && idNode.ValueKind == JsonValueKind.String ? idNode.GetString() : null;
                    var memberName = member.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() : null;
                    if (string.IsNullOrWhiteSpace(memberId) || string.IsNullOrWhiteSpace(memberName)) continue;
                    var mid = memberId.Trim();
                    if (owned.Contains(mid))
                    {
                        continue;
                    }

                    foreach (var target in targets)
                    {
                        var label = $"{target.username} : {familyName} - {memberName.Trim()}";
                        var key = MakeUniqueChoiceLabel(choices, label);
                        choices[key] = new GameClientAction(
                            "ask_card",
                            payload: new { targetId = target.id, familyId = familyId, memberId = mid });
                    }
                }
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

    private static string MakeUniqueChoiceLabel(Dictionary<string, GameClientAction> existing, string label)
    {
        var baseLabel = (label ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(baseLabel))
        {
            baseLabel = "Choix";
        }

        if (!existing.ContainsKey(baseLabel))
        {
            return baseLabel;
        }

        var i = 2;
        while (true)
        {
            var candidate = $"{baseLabel} ({i})";
            if (!existing.ContainsKey(candidate))
            {
                return candidate;
            }
            i++;
        }
    }
}

