using System.Collections.Generic;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal static class GamePlayWinnerReader
{
    internal enum Outcome
    {
        Won,
        Lost
    }

    internal static Outcome? TryExtractOutcomeForViewer(GameStateDto? state, int viewerPlayerId)
    {
        if (state == null || viewerPlayerId <= 0)
        {
            return null;
        }

        static Outcome? ReadOutcome(System.Text.Json.JsonElement element, int id)
        {
            if (element.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return null;
            }

            if (!element.TryGetProperty("outcomesByPlayerId", out var outcomes) ||
                outcomes.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return null;
            }

            var key = id.ToString();
            if (!outcomes.TryGetProperty(key, out var entry) ||
                entry.ValueKind != System.Text.Json.JsonValueKind.String)
            {
                return null;
            }

            var value = (entry.GetString() ?? string.Empty).Trim();
            if (string.Equals(value, "won", System.StringComparison.OrdinalIgnoreCase)) return Outcome.Won;
            if (string.Equals(value, "lost", System.StringComparison.OrdinalIgnoreCase)) return Outcome.Lost;
            return null;
        }

        return ReadOutcome(state.Metadata, viewerPlayerId) ?? ReadOutcome(state.Extras, viewerPlayerId);
    }

    internal static Dictionary<int, string> TryExtractOutcomeMap(GameStateDto? state)
    {
        var outcomes = new Dictionary<int, string>();
        if (state == null)
        {
            return outcomes;
        }

        TryReadOutcomeMap(state.Metadata, outcomes);
        TryReadOutcomeMap(state.Extras, outcomes);
        return outcomes;
    }

    internal static int? TryExtractWinnerPlayerId(GameStateDto? state)
    {
        if (state == null)
        {
            return null;
        }

        // Best-effort: games may store winner info in metadata under various keys.
        static int? ReadWinnerId(System.Text.Json.JsonElement element)
        {
            if (element.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return null;
            }

            foreach (var key in new[] { "winnerPlayerId", "winnerId", "winner_id" })
            {
                if (element.TryGetProperty(key, out var prop) &&
                    prop.ValueKind == System.Text.Json.JsonValueKind.Number)
                {
                    try { return prop.GetInt32(); } catch { /* ignore */ }
                }
            }

            return null;
        }

        return ReadWinnerId(state.Metadata) ?? ReadWinnerId(state.Extras);
    }

    private static void TryReadOutcomeMap(System.Text.Json.JsonElement source, Dictionary<int, string> target)
    {
        if (source.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            return;
        }

        if (!source.TryGetProperty("outcomesByPlayerId", out var outcomes) ||
            outcomes.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            return;
        }

        foreach (var prop in outcomes.EnumerateObject())
        {
            if (!int.TryParse(prop.Name, out var playerId) || playerId <= 0)
            {
                continue;
            }
            if (prop.Value.ValueKind != System.Text.Json.JsonValueKind.String)
            {
                continue;
            }

            var value = (prop.Value.GetString() ?? string.Empty).Trim();
            if (value.Length == 0)
            {
                continue;
            }

            target[playerId] = value;
        }
    }
}
