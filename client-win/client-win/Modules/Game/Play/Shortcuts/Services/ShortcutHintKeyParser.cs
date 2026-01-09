using System;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;

namespace client_win.Modules.Game.Play.Shortcuts.Services;

internal static class ShortcutHintKeyParser
{
    internal static char? FindActionShortcutKey(GameStateDto state, string actionType)
    {
        var hints = GamePlayExtrasParser.ExtractShortcutHints(state);
        foreach (var hint in hints)
        {
            if (!string.Equals(hint.Type, "action", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!string.Equals(hint.ActionType, actionType, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (TryParseCharKey(hint.Key, out var key))
            {
                return key;
            }
        }

        return null;
    }

    internal static char? FindInterfaceShortcutKey(GameStateDto state, string id)
    {
        var hints = GamePlayExtrasParser.ExtractShortcutHints(state);
        foreach (var hint in hints)
        {
            if (!string.Equals(hint.Type, "interface", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!string.Equals(hint.Id, id, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (TryParseCharKey(hint.Key, out var key))
            {
                return key;
            }
        }

        return null;
    }

    private static bool TryParseCharKey(string? raw, out char key)
    {
        key = default;
        var s = raw ?? string.Empty;
        const string prefix = "pressed ";
        if (s.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            s = s.Substring(prefix.Length).Trim();
        }

        if (s.Length == 1 && char.IsLetter(s[0]))
        {
            key = char.ToLowerInvariant(s[0]);
            return true;
        }

        return false;
    }
}

