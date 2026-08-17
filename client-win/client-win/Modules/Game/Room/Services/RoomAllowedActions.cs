using System;
using System.Collections.Generic;
using client_win.Core.Constants;
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
            WsMessageTypes.Room.Reset => RoomShortcutCodes.Reset,
            WsMessageTypes.Room.Info => RoomShortcutCodes.Info,
            "room.togglerole" => RoomShortcutCodes.ToggleRole,
            WsMessageTypes.Room.SetRole => RoomShortcutCodes.ToggleRole,
            "room.toggleprivacy" => RoomShortcutCodes.TogglePrivacy,
            WsMessageTypes.Room.TogglePrivacy => RoomShortcutCodes.TogglePrivacy,
            "room.players" => RoomShortcutCodes.Players,
            "room.addbot" => RoomShortcutCodes.AddBot,
            WsMessageTypes.Room.AddBot => RoomShortcutCodes.AddBot,
            "room.removebot" => RoomShortcutCodes.RemoveBot,
            WsMessageTypes.Room.RemoveBot => RoomShortcutCodes.RemoveBot,
            "room.invite" => RoomShortcutCodes.Invite,
            WsMessageTypes.Room.Kick => RoomShortcutCodes.Kick,
            WsMessageTypes.Room.Ban => RoomShortcutCodes.Ban,
            "room.transferowner" => RoomShortcutCodes.TransferOwner,
            WsMessageTypes.Room.SetOwner => RoomShortcutCodes.TransferOwner,
            "room.quit" => RoomShortcutCodes.Quit,
            WsMessageTypes.Room.Leave => RoomShortcutCodes.Quit,
            _ => key,
        };
    }

    private static string Normalize(string? action) => (action ?? string.Empty).Trim().ToLowerInvariant();
}
