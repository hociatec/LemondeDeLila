using System.Text.Json;

namespace client_win.Modules.Game.Play.Common;

internal static class PawnPayloadReader
{
    internal static string? TryReadPawnId(JsonElement payload)
    {
        return JsonPayloadReader.TryReadString(payload, "id")
               ?? JsonPayloadReader.TryReadString(payload, "pawnId")
               ?? JsonPayloadReader.TryReadString(payload, "pawn")
               ?? JsonPayloadReader.TryReadString(payload, "value");
    }
}
