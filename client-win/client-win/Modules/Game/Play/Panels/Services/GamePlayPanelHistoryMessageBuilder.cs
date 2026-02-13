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
            var caseNumber = Math.Max(1, rawPos + 1);
            sb.Append(label).Append(" case ").Append(caseNumber);
        }

        return sb.ToString().Trim();
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
