using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.Services;

internal static class GamePlayShortcutKeyFormatter
{
    internal static string ToDisplay(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return string.Empty;
        }

        var trimmed = key.Trim();
        const string pressed = "pressed ";
        if (trimmed.StartsWith(pressed, StringComparison.OrdinalIgnoreCase))
        {
            return trimmed.Substring(pressed.Length).Trim();
        }

        return trimmed;
    }
}

internal static class GamePlayExtrasParser
{
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
        public string[] ShoppingList { get; init; } = Array.Empty<string>();
        public string[] Basket { get; init; } = Array.Empty<string>();
        public string[] Inventory { get; init; } = Array.Empty<string>();
        public string[] Stable { get; init; } = Array.Empty<string>();
        public string[] Position { get; init; } = Array.Empty<string>();
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
                ShoppingList = ExtractStringArray(view, "shoppingList"),
                Basket = ExtractStringArray(view, "basket"),
                Inventory = ExtractStringArray(view, "inventory"),
                Stable = ExtractStringArray(view, "stable"),
                Position = ExtractStringArray(view, "position"),
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

    private static string[] ExtractStringArray(JsonElement obj, string key)
    {
        if (!obj.TryGetProperty(key, out var node) || node.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<string>();
        }

        return node.EnumerateArray()
            .Where(e => e.ValueKind == JsonValueKind.String)
            .Select(e => e.GetString() ?? string.Empty)
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToArray();
    }
}
