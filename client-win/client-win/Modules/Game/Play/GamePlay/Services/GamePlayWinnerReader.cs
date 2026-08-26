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
        var winners = ReadWinnerIds(state.Extras);
        if (winners.Count == 0) return null;
        return winners.Contains(viewerPlayerId) ? Outcome.Won : Outcome.Lost;
    }

    internal static Dictionary<int, string> TryExtractOutcomeMap(GameStateDto? state)
    {
        var outcomes = new Dictionary<int, string>();
        if (state == null)
        {
            return outcomes;
        }

        var winners = ReadWinnerIds(state.Extras);
        if (winners.Count == 0) return outcomes;
        foreach (var player in state.Players ?? [])
        {
            outcomes[player.Id] = winners.Contains(player.Id) ? "won" : "lost";
        }
        return outcomes;
    }

    internal static int? TryExtractWinnerPlayerId(GameStateDto? state)
    {
        if (state == null)
        {
            return null;
        }

        var winners = ReadWinnerIds(state.Extras);
        return winners.Count == 0 ? null : winners[0];
    }

    private static List<int> ReadWinnerIds(System.Text.Json.JsonElement extras)
    {
        var winners = new List<int>();
        if (extras.ValueKind != System.Text.Json.JsonValueKind.Object ||
            !extras.TryGetProperty("match", out var match) ||
            match.ValueKind != System.Text.Json.JsonValueKind.Object ||
            !match.TryGetProperty("result", out var result) ||
            result.ValueKind != System.Text.Json.JsonValueKind.Object ||
            !result.TryGetProperty("winnerPlayerIds", out var ids) ||
            ids.ValueKind != System.Text.Json.JsonValueKind.Array)
        {
            return winners;
        }

        foreach (var element in ids.EnumerateArray())
        {
            if (element.ValueKind == System.Text.Json.JsonValueKind.Number &&
                element.TryGetInt32(out var playerId) && playerId > 0)
                winners.Add(playerId);
        }
        return winners;
    }
}
