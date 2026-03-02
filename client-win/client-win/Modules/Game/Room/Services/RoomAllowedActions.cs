using System;
using System.Collections.Generic;
using client_win.Modules.Game.Room.Input;

namespace client_win.Modules.Game.Room.Services;

internal static class RoomAllowedActions
{
    public static bool Contains(RoomDto? room, string action)
    {
        var expected = Normalize(action);
        if (expected.Length == 0 || room?.AllowedActions == null || room.AllowedActions.Count == 0)
        {
            return false;
        }

        foreach (var candidate in room.AllowedActions)
        {
            if (string.Equals(Normalize(candidate), expected, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    public static HashSet<string> ToNormalizedSet(RoomDto? room)
    {
        var actions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (room?.AllowedActions == null || room.AllowedActions.Count == 0)
        {
            return actions;
        }

        foreach (var candidate in room.AllowedActions)
        {
            var normalized = Normalize(candidate);
            if (normalized.Length > 0)
            {
                actions.Add(normalized);
            }
        }

        return actions;
    }

    public static HashSet<string> ToShortcutCodeSet(RoomDto? room)
    {
        var codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var action in ToNormalizedSet(room))
        {
            var code = ToShortcutCode(action);
            if (!string.IsNullOrWhiteSpace(code))
            {
                codes.Add(code);
            }
        }

        return codes;
    }

    public static string? ToShortcutCode(string? action)
    {
        var key = Normalize(action);
        if (key.Length == 0)
        {
            return null;
        }

        return key switch
        {
            "room.rules" => RoomShortcutCodes.Rules,
            "room.tableambience" => RoomShortcutCodes.TableAmbience,
            "room.tableambiencevolume" => RoomShortcutCodes.TableAmbienceVolume,
            "room.savesnapshot" => RoomShortcutCodes.SaveSnapshot,
            "room.snapshot.save" => RoomShortcutCodes.SaveSnapshot,
            "room.reset" => RoomShortcutCodes.Reset,
            "room.info" => RoomShortcutCodes.Info,
            "room.togglerole" => RoomShortcutCodes.ToggleRole,
            "room.set-role" => RoomShortcutCodes.ToggleRole,
            "room.toggleprivacy" => RoomShortcutCodes.TogglePrivacy,
            "room.toggle-privacy" => RoomShortcutCodes.TogglePrivacy,
            "room.players" => RoomShortcutCodes.Players,
            "room.addbot" => RoomShortcutCodes.AddBot,
            "bot.add" => RoomShortcutCodes.AddBot,
            "room.removebot" => RoomShortcutCodes.RemoveBot,
            "bot.remove" => RoomShortcutCodes.RemoveBot,
            "room.invite" => RoomShortcutCodes.Invite,
            "room.kick" => RoomShortcutCodes.Kick,
            "room.ban" => RoomShortcutCodes.Ban,
            "room.transferowner" => RoomShortcutCodes.TransferOwner,
            "room.set-owner" => RoomShortcutCodes.TransferOwner,
            "room.quit" => RoomShortcutCodes.Quit,
            "room.leave" => RoomShortcutCodes.Quit,
            _ => key,
        };
    }

    private static string Normalize(string? action) => (action ?? string.Empty).Trim().ToLowerInvariant();
}
