using System;
using System.Collections.Generic;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel
{
    private void RefreshCanExecute()
    {
        _commands.RefreshCanExecute();
        Grid.RefreshCanExecute();
    }

    private void SyncShortcuts(GameStateDto state)
    {
        UpdateServerKeyActionIndex(state);
        _shortcuts.SyncFromState(state);
    }

    private void UpdateServerKeyActionIndex(GameStateDto state)
    {
        var next = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var hint in GamePlayExtrasParser.ExtractShortcutHints(state))
        {
            var actionType = (hint.ActionType ?? string.Empty).Trim();
            if (actionType.Length == 0)
            {
                continue;
            }

            if (!TryNormalizeServerKey(hint.Key, out var normalizedKey))
            {
                continue;
            }

            next[normalizedKey] = actionType;
        }

        _actionTypeByServerKey = next;
    }

    private static bool TryNormalizeServerKey(string raw, out string normalizedKey)
    {
        normalizedKey = string.Empty;

        var s = (raw ?? string.Empty).Trim();
        const string prefix = "pressed ";
        if (s.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            s = s.Substring(prefix.Length).Trim();
        }

        if (s.Length == 1 && char.IsLetter(s[0]))
        {
            normalizedKey = char.ToUpperInvariant(s[0]).ToString();
            return true;
        }

        if (s.Length == 1 && char.IsDigit(s[0]))
        {
            normalizedKey = s[0].ToString();
            return true;
        }

        var v = s.ToUpperInvariant();
        switch (v)
        {
            case "SPACE":
                normalizedKey = "SPACE";
                return true;
            case "ENTER":
            case "RETURN":
                normalizedKey = "ENTER";
                return true;
            case "BACK":
            case "BACKSPACE":
                normalizedKey = "BACK";
                return true;
            default:
                return false;
        }
    }
}
