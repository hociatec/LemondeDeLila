using System;
using System.Linq;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;

namespace client_win.Modules.Game.Play.Panels.Services;

internal static class GamePlayPanelHistoryMessageBuilder
{
    internal static string BuildPanelHistoryMessage(GameStateDto state, string panelId)
    {
        if (!string.IsNullOrWhiteSpace(panelId) &&
            GamePlayUiPanelsParser.TryGetPanelMessage(state, panelId.Trim(), out var message))
        {
            return message;
        }

        // Legacy fallback: for older servers still using specific extras.
        var id = (panelId ?? string.Empty).Trim();

        string[] items;
        string title;

        switch (id.ToLowerInvariant())
        {
            case "shopping":
                title = "Shopping list";
                items = GamePlayExtrasParser.ExtractCurrentPlayerView(state).ShoppingList;
                break;
            case "pollution":
                return BuildPollutionHistoryMessage(state);
            case "stable":
                return BuildStableHistoryMessage(state);
            case "score":
                title = "Score";
                items = ExtractExtrasStringArray(state, "score");
                break;
            case "basket":
                title = "Panier";
                items = GamePlayExtrasParser.ExtractCurrentPlayerView(state).Basket;
                break;
            case "inventory":
                title = "Inventaire";
                items = GamePlayExtrasParser.ExtractCurrentPlayerView(state).Inventory;
                break;
            case "hand":
                title = "Main";
                items = ExtractExtrasStringArray(state, "hand");
                break;
            case "books":
                title = "Familles";
                items = ExtractExtrasStringArray(state, "books");
                break;
            default:
                return string.Empty;
        }

        if (items.Length == 0)
        {
            return $"{title}: (vide)";
        }

        const int max = 12;
        var shown = items.Length > max ? items[..max] : items;
        var body = string.Join(", ", shown);
        if (items.Length > max)
        {
            body += $", ... (+{items.Length - max})";
        }

        return $"{title}: {body}";
    }

    internal static string BuildPositionHistoryMessage(GameStateDto state)
    {
        if (GamePlayUiPanelsParser.TryGetPanelMessage(state, "position", out var message))
        {
            return message;
        }

        var positionLines = GamePlayExtrasParser.ExtractCurrentPlayerView(state).Position;
        if (positionLines.Length > 0)
        {
            static string Normalize(string text)
            {
                var t = (text ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(t))
                {
                    return string.Empty;
                }
                return t.EndsWith(".", StringComparison.Ordinal) ? t : $"{t}.";
            }

            var normalized = positionLines.Select(Normalize).Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
            if (normalized.Length > 0)
            {
                return string.Join(" ", normalized);
            }
        }

        var playerId = GamePlayExtrasParser.ExtractCurrentPlayerId(state);
        var board = state.Board;
        var position = TryGetFromMap(board?.Positions, playerId);
        var lap = TryGetFromMap(board?.Laps, playerId);

        var totalTiles = TryGetTilesCount(board?.Tiles);

        if (position == null || totalTiles == null || totalTiles.Value <= 0)
        {
            return "Case: inconnue.";
        }

        var caseNumber = position.Value + 1; // user-friendly 1-based
        var tourPlateau = lap != null ? lap.Value.ToString() : "?";
        return $"Tour plateau {tourPlateau}, case {caseNumber}/{totalTiles.Value}.";
    }

    private static string BuildStableHistoryMessage(GameStateDto state)
    {
        var lines = GamePlayExtrasParser.ExtractCurrentPlayerView(state).Stable;
        if (lines.Length == 0)
        {
            return "Écurie: inconnue.";
        }

        static string Normalize(string text)
        {
            var t = (text ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(t))
            {
                return string.Empty;
            }
            return t.EndsWith(".", StringComparison.Ordinal) ? t : $"{t}.";
        }

        var normalized = lines.Select(Normalize).Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
        if (normalized.Length == 0)
        {
            return "Écurie: inconnue.";
        }

        return string.Join(" ", normalized);
    }

    private static string BuildPollutionHistoryMessage(GameStateDto state)
    {
        try
        {
            if (state.Metadata.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return "Pollution: inconnue.";
            }

            int? pollution = null;
            int? max = null;

            if (state.Metadata.TryGetProperty("pollution", out var p) &&
                p.ValueKind == System.Text.Json.JsonValueKind.Number &&
                p.TryGetInt32(out var pInt))
            {
                pollution = pInt;
            }

            if (state.Metadata.TryGetProperty("maxPollution", out var m) &&
                m.ValueKind == System.Text.Json.JsonValueKind.Number &&
                m.TryGetInt32(out var mInt))
            {
                max = mInt;
            }

            if (pollution == null && max == null)
            {
                return "Pollution: inconnue.";
            }

            if (pollution != null && max != null)
            {
                return $"Pollution: {pollution.Value}/{max.Value}.";
            }

            if (pollution != null)
            {
                return $"Pollution: {pollution.Value}.";
            }

            return $"Pollution max: {max}.";
        }
        catch
        {
            return "Pollution: inconnue.";
        }
    }

    private static int? TryGetTilesCount(System.Text.Json.JsonElement? tiles)
    {
        if (tiles == null)
        {
            return null;
        }

        var t = tiles.Value;
        return t.ValueKind == System.Text.Json.JsonValueKind.Array ? t.GetArrayLength() : null;
    }

    private static int? TryGetFromMap(System.Collections.Generic.Dictionary<string, int>? map, int? playerId)
    {
        if (map == null || playerId == null)
        {
            return null;
        }

        var key = playerId.Value.ToString();
        if (map.TryGetValue(key, out var v))
        {
            return v;
        }

        var alt = map.Keys.FirstOrDefault(k => string.Equals(k, key, StringComparison.OrdinalIgnoreCase));
        if (alt != null && map.TryGetValue(alt, out var v2))
        {
            return v2;
        }

        return null;
    }

    private static string[] ExtractExtrasStringArray(GameStateDto state, string key)
    {
        try
        {
            if (state.Extras.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return Array.Empty<string>();
            }

            if (!state.Extras.TryGetProperty(key, out var node) ||
                node.ValueKind != System.Text.Json.JsonValueKind.Array)
            {
                return Array.Empty<string>();
            }

            return node.EnumerateArray()
                .Where(e => e.ValueKind == System.Text.Json.JsonValueKind.String)
                .Select(e => (e.GetString() ?? string.Empty).Trim())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToArray();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }
}
