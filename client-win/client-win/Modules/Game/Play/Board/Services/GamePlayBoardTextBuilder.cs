using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Board.Services;

internal static class GamePlayBoardTextBuilder
{
    internal static string Build(GameStateDto? state)
    {
        var board = state?.Board;
        if (board == null)
        {
            return string.Empty;
        }

        var tilesCount = TryGetArrayLength(board.Tiles);

        var positions = board.Positions ?? new Dictionary<string, int>();
        var laps = board.Laps ?? new Dictionary<string, int>();
        var turns = board.Turns ?? new Dictionary<string, int>();

        if (tilesCount <= 0 && positions.Count == 0 && laps.Count == 0 && turns.Count == 0)
        {
            return string.Empty;
        }

        var playersById = (state?.Players ?? new List<GamePlayerDto>())
            .Where(p => p != null)
            .ToDictionary(p => p.Id, p => (p.Username ?? string.Empty).Trim());

        var sb = new StringBuilder();
        sb.AppendLine("Plateau (serveur)");

        if (tilesCount > 0)
        {
            sb.Append("Cases: ").AppendLine(tilesCount.ToString());
        }

        AppendIdMap(sb, "Positions", positions, playersById);
        AppendIdMap(sb, "Tours", laps, playersById);
        AppendIdMap(sb, "Tour courant", turns, playersById);

        return sb.ToString().Trim();
    }

    private static int TryGetArrayLength(JsonElement element)
    {
        try
        {
            return element.ValueKind == JsonValueKind.Array ? element.GetArrayLength() : 0;
        }
        catch
        {
            return 0;
        }
    }

    private static void AppendIdMap(
        StringBuilder sb,
        string label,
        Dictionary<string, int> map,
        Dictionary<int, string> playersById)
    {
        if (map.Count == 0)
        {
            return;
        }

        sb.AppendLine(label + ":");
        foreach (var (key, value) in map.OrderBy(kv => TryParseId(kv.Key, out var id) ? id : int.MaxValue)
                     .ThenBy(kv => kv.Key, StringComparer.Ordinal))
        {
            var name = ResolvePlayerLabel(key, playersById);
            sb.Append(" - ").Append(name).Append(": ").AppendLine(value.ToString());
        }
    }

    private static string ResolvePlayerLabel(string key, Dictionary<int, string> playersById)
    {
        if (TryParseId(key, out var id))
        {
            if (playersById.TryGetValue(id, out var username) && !string.IsNullOrWhiteSpace(username))
            {
                return username;
            }
            return $"Joueur {id}";
        }

        return $"Joueur {key}";
    }

    private static bool TryParseId(string? raw, out int id) =>
        int.TryParse((raw ?? string.Empty).Trim(), out id);
}

