using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal static class GamePlayWinnerReader
{
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
}

