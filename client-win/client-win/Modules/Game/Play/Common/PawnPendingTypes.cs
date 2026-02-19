using System;

namespace client_win.Modules.Game.Play.Common;

internal static class PawnPendingTypes
{
    internal static string Normalize(string? pendingType)
    {
        return (pendingType ?? string.Empty).Trim();
    }

    internal static bool IsPawnPendingType(string? pendingType)
    {
        var normalized = Normalize(pendingType);
        return string.Equals(normalized, "choose_pawn", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(normalized, "pick_pawn", StringComparison.OrdinalIgnoreCase);
    }
}
