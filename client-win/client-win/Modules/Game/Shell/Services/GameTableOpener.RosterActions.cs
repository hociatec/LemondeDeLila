using System;
using System.Collections.Generic;
using System.Linq;
using client_win.Modules.Game.Room.Lobby.Services;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Shell.Services;

public sealed partial class GameTableOpener
{
    private enum RosterEntryKind
    {
        Player,
        Spectator,
        Bot
    }

    private sealed record RosterEntry(int Id, string Name, RosterEntryKind Kind);

    private static IReadOnlyList<RosterEntry> BuildRoster(IRoomSession session)
    {
        var room = session?.LastRoomState?.Room;
        if (room == null)
        {
            return Array.Empty<RosterEntry>();
        }

        var byKey = new Dictionary<string, RosterEntry>(StringComparer.Ordinal);

        foreach (var p in room.Players ?? new List<RoomUserDto>())
        {
            if (p == null || p.Id <= 0) continue;
            var name = (p.Username ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            byKey[$"user:{p.Id}"] = new RosterEntry(p.Id, name, RosterEntryKind.Player);
        }

        foreach (var s in room.Spectators ?? new List<RoomUserDto>())
        {
            if (s == null || s.Id <= 0) continue;
            var name = (s.Username ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            byKey[$"user:{s.Id}"] = new RosterEntry(s.Id, name, RosterEntryKind.Spectator);
        }

        foreach (var b in room.Bots ?? new List<RoomBotDto>())
        {
            if (b == null || b.Id <= 0) continue;
            var name = (b.Name ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            byKey[$"bot:{b.Id}"] = new RosterEntry(b.Id, name, RosterEntryKind.Bot);
        }

        return byKey.Values
            .OrderBy(x => x.Kind)
            .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
