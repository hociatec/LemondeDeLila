using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Panels.Services;

internal static class GamePlayPanelHistoryMessageBuilder
{
    internal static string BuildPanelHistoryMessage(GameStateDto state, string panelId)
    {
        if (state == null || string.IsNullOrWhiteSpace(panelId))
        {
            return string.Empty;
        }

        var normalizedPanelId = panelId.Trim();
        if (string.Equals(normalizedPanelId, "position", StringComparison.OrdinalIgnoreCase))
        {
            var allPlayersPositions = BuildAllPlayersPositionsMessage(state);
            if (!string.IsNullOrWhiteSpace(allPlayersPositions))
            {
                return allPlayersPositions;
            }
        }

        return GamePlayUiPanelsParser.TryGetPanelMessage(state, normalizedPanelId, out var message) ? message : string.Empty;
    }

    internal static string BuildPositionHistoryMessage(GameStateDto state)
    {
        var allPlayersPositions = BuildAllPlayersPositionsMessage(state);
        if (!string.IsNullOrWhiteSpace(allPlayersPositions))
        {
            return allPlayersPositions;
        }

        return GamePlayUiPanelsParser.TryGetPanelMessage(state, "position", out var message) ? message : string.Empty;
    }

    private static string BuildAllPlayersPositionsMessage(GameStateDto state)
    {
        if (state == null)
        {
            return string.Empty;
        }

        var positions = state.Board?.Positions;
        if (positions == null || positions.Count == 0)
        {
            return string.Empty;
        }

        var playersById = (state.Players ?? new List<GamePlayerDto>())
            .OfType<GamePlayerDto>()
            .ToDictionary(p => p.Id, p => string.IsNullOrWhiteSpace(p.Username) ? $"Joueur {p.Id}" : p.Username.Trim());

        var ordered = positions
            .OrderBy(kv => TryParsePlayerId(kv.Key, out var id) ? id : int.MaxValue)
            .ThenBy(kv => kv.Key, StringComparer.Ordinal);
        var gridSize = TryGetGridSize(state);

        var sb = new StringBuilder("Positions. ");
        var first = true;
        foreach (var (playerKey, rawPos) in ordered)
        {
            if (!first)
            {
                sb.Append(". ");
            }

            first = false;
            var label = ResolvePlayerLabel(playerKey, playersById);
            sb.Append(label).Append(' ').Append(FormatPosition(rawPos, gridSize));
        }

        return sb.ToString().Trim();
    }

    private static string FormatPosition(int rawPos, int gridSize)
    {
        if (gridSize > 0)
        {
            var safe = Math.Max(0, rawPos);
            var x = safe % gridSize;
            var y = safe / gridSize;
            return ToGridCellRef(x, y, gridSize).ToLowerInvariant();
        }

        var caseNumber = Math.Max(1, rawPos + 1);
        return $"case {caseNumber}";
    }

    private static int TryGetGridSize(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != System.Text.Json.JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != System.Text.Json.JsonValueKind.Object ||
                !grid.TryGetProperty("size", out var sizeNode))
            {
                return 0;
            }

            if (sizeNode.ValueKind == System.Text.Json.JsonValueKind.Number &&
                sizeNode.TryGetInt32(out var size) &&
                size > 0)
            {
                return size;
            }

            if (sizeNode.ValueKind == System.Text.Json.JsonValueKind.String &&
                int.TryParse(sizeNode.GetString(), out var parsed) &&
                parsed > 0)
            {
                return parsed;
            }
        }
        catch
        {
            // ignore
        }

        return 0;
    }

    private static string ToGridCellRef(int x, int y, int size)
    {
        if (size <= 0)
        {
            return $"{x},{y}";
        }

        var col = ToColumnLetters(x + 1);
        var row = Math.Max(1, size - y);
        return $"{col}{row}";
    }

    private static string ToColumnLetters(int column)
    {
        var n = Math.Max(1, column);
        var letters = string.Empty;
        while (n > 0)
        {
            n--;
            letters = $"{(char)('A' + (n % 26))}{letters}";
            n /= 26;
        }
        return letters;
    }

    private static string ResolvePlayerLabel(string key, Dictionary<int, string> playersById)
    {
        if (TryParsePlayerId(key, out var id))
        {
            if (playersById.TryGetValue(id, out var username) && !string.IsNullOrWhiteSpace(username))
            {
                return username;
            }

            return $"Joueur {id}";
        }

        return $"Joueur {key}";
    }

    private static bool TryParsePlayerId(string? raw, out int id) =>
        int.TryParse((raw ?? string.Empty).Trim(), out id);
}
