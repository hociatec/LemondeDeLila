using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.State.Services;

internal static class GamePlayExtrasParser
{
    internal sealed class HandCardInfo
    {
        public HandCardInfo(string cardId, string label, bool disabled, string? color, string? family, int index)
        {
            CardId = cardId ?? string.Empty;
            Label = label ?? string.Empty;
            Disabled = disabled;
            Color = color;
            Family = family;
            Index = index;
        }

        public string CardId { get; }
        public string Label { get; }
        public bool Disabled { get; }
        public string? Color { get; }
        public string? Family { get; }
        public int Index { get; }
    }

    internal sealed class ShortcutHint
    {
        public string Key { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public string? Id { get; init; }
        public string? ActionType { get; init; }
    }

    internal sealed class PlayerView
    {
        public int? Id { get; init; }
        public string? Username { get; init; }
    }

    internal static List<ShortcutHint> ExtractShortcutHints(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object)
            {
                return new List<ShortcutHint>();
            }

            if (!state.Extras.TryGetProperty("shortcuts", out var shortcuts) ||
                shortcuts.ValueKind != JsonValueKind.Array)
            {
                return new List<ShortcutHint>();
            }

            var list = new List<ShortcutHint>();
            foreach (var item in shortcuts.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object) continue;

                var key = item.TryGetProperty("key", out var k) ? k.GetString() : null;
                var type = item.TryGetProperty("type", out var t) ? t.GetString() : null;
                var id = item.TryGetProperty("id", out var idNode) ? idNode.GetString() : null;
                var actionType = item.TryGetProperty("actionType", out var a) ? a.GetString() : null;

                if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(type)) continue;

                list.Add(new ShortcutHint
                {
                    Key = key.Trim(),
                    Type = type.Trim(),
                    Id = string.IsNullOrWhiteSpace(id) ? null : id.Trim(),
                    ActionType = string.IsNullOrWhiteSpace(actionType) ? null : actionType.Trim()
                });
            }

            return list;
        }
        catch
        {
            return new List<ShortcutHint>();
        }
    }

    internal static PlayerView ExtractCurrentPlayerView(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object)
            {
                return new PlayerView();
            }
            if (!state.Extras.TryGetProperty("currentPlayerView", out var view) ||
                view.ValueKind != JsonValueKind.Object)
            {
                return new PlayerView();
            }

            return new PlayerView
            {
                Id = ExtractInt(view, "id"),
                Username = view.TryGetProperty("username", out var u) && u.ValueKind == JsonValueKind.String
                    ? u.GetString()?.Trim()
                    : null,
            };
        }
        catch
        {
            return new PlayerView();
        }
    }

    internal static int? ExtractCurrentPlayerId(GameStateDto state)
    {
        return ExtractCurrentPlayerView(state).Id;
    }

    internal static int? ExtractViewerPlayerId(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind == JsonValueKind.Object &&
                state.Extras.TryGetProperty("viewerPlayerId", out var idNode))
            {
                if (idNode.ValueKind == JsonValueKind.Number && idNode.TryGetInt32(out var asInt))
                {
                    return asInt;
                }

                if (idNode.ValueKind == JsonValueKind.String &&
                    int.TryParse(idNode.GetString(), out var parsed))
                {
                    return parsed;
                }
            }
        }
        catch
        {
            // ignore
        }

        // Fallback compat: si le serveur n'envoie pas viewerPlayerId, on ne peut pas filtrer proprement.
        // IMPORTANT: ne pas confondre avec currentPlayerId, sinon on cache la main (ex: LAMA hors tour).
        return null;
    }

    internal static List<HandCardInfo> ExtractHandCards(GameStateDto state)
    {
        var cards = new List<HandCardInfo>();
        try
        {
            if (state == null || state.Extras.ValueKind != JsonValueKind.Object)
            {
                return cards;
            }

            if (!state.Extras.TryGetProperty("hand", out var handNode) ||
                handNode.ValueKind != JsonValueKind.Array)
            {
                return cards;
            }

            var handIds = new List<string>();
            if (state.Extras.TryGetProperty("handIds", out var handIdsNode) &&
                handIdsNode.ValueKind == JsonValueKind.Array)
            {
                foreach (var idNode in handIdsNode.EnumerateArray())
                {
                    if (idNode.ValueKind == JsonValueKind.String)
                    {
                        var value = (idNode.GetString() ?? string.Empty).Trim();
                        handIds.Add(value);
                    }
                    else
                    {
                        handIds.Add(string.Empty);
                    }
                }
            }

            var index = 0;
            foreach (var item in handNode.EnumerateArray())
            {
                string? cardId = null;
                string label = string.Empty;
                bool disabled = false;
                string? color = null;
                string? family = null;

                if (item.ValueKind == JsonValueKind.String)
                {
                    var text = (item.GetString() ?? string.Empty).Trim();
                    if (text.Length == 0)
                    {
                        index++;
                        continue;
                    }
                    var idFallback = index < handIds.Count ? handIds[index] : string.Empty;
                    cardId = !string.IsNullOrWhiteSpace(idFallback) ? idFallback : text;
                    label = text;
                }
                else if (item.ValueKind == JsonValueKind.Object)
                {
                    cardId = GetString(item, "id");
                    if (string.IsNullOrWhiteSpace(cardId))
                    {
                        var idFallback = index < handIds.Count ? handIds[index] : string.Empty;
                        cardId = !string.IsNullOrWhiteSpace(idFallback) ? idFallback : null;
                    }
                    label = GetString(item, "label") ?? string.Empty;
                    color = GetString(item, "color");
                    family = GetString(item, "family") ?? GetString(item, "familyId");
                    if (string.IsNullOrWhiteSpace(label))
                    {
                        label = cardId ?? string.Empty;
                    }
                    if (item.TryGetProperty("disabled", out var disabledNode))
                    {
                        if (disabledNode.ValueKind == JsonValueKind.True)
                        {
                            disabled = true;
                        }
                        else if (disabledNode.ValueKind == JsonValueKind.String &&
                            bool.TryParse(disabledNode.GetString(), out var parsed))
                        {
                            disabled = parsed;
                        }
                    }
                }

                if (string.IsNullOrWhiteSpace(label))
                {
                    index++;
                    continue;
                }

                var resolvedId = !string.IsNullOrWhiteSpace(cardId) ? cardId.Trim() : label.Trim();
                cards.Add(new HandCardInfo(
                    cardId: resolvedId,
                    label: label.Trim(),
                    disabled: disabled,
                    color: color,
                    family: family,
                    index: index));
                index++;
            }

            return cards;
        }
        catch
        {
            return new List<HandCardInfo>();
        }
    }

    internal static List<string> ExtractViewerHandLabels(GameStateDto state)
    {
        try
        {
            return ExtractHandCards(state)
                .Select(card => card.Label ?? string.Empty)
                .Where(label => !string.IsNullOrWhiteSpace(label))
                .ToList();
        }
        catch
        {
            return new List<string>();
        }
    }

    internal static string? ExtractHandStage(GameStateDto state)
    {
        if (state == null || state.Extras.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!state.Extras.TryGetProperty("stage", out var node) ||
            node.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var trimmed = node.GetString()?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    internal static List<int> ExtractWaitingPlayers(GameStateDto state)
    {
        var list = new List<int>();
        if (state == null || state.Extras.ValueKind != JsonValueKind.Object)
        {
            return list;
        }

        if (!state.Extras.TryGetProperty("waitingPlayers", out var node) ||
            node.ValueKind != JsonValueKind.Array)
        {
            return list;
        }

        foreach (var entry in node.EnumerateArray())
        {
            if (entry.ValueKind == JsonValueKind.Number && entry.TryGetInt32(out var asInt))
            {
                list.Add(asInt);
                continue;
            }

            if (entry.ValueKind == JsonValueKind.String && int.TryParse(entry.GetString(), out var parsed))
            {
                list.Add(parsed);
            }
        }

        return list;
    }

    private static string? GetString(JsonElement obj, string key)
    {
        if (string.IsNullOrWhiteSpace(key) || obj.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!obj.TryGetProperty(key, out var node) || node.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var trimmed = node.GetString();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed.Trim();
    }

    private static int? ExtractInt(JsonElement obj, string key)
    {
        if (!obj.TryGetProperty(key, out var node))
        {
            return null;
        }

        if (node.ValueKind == JsonValueKind.Number && node.TryGetInt32(out var asInt))
        {
            return asInt;
        }

        if (node.ValueKind == JsonValueKind.String &&
            int.TryParse(node.GetString(), out var parsed))
        {
            return parsed;
        }

        return null;
    }
}
