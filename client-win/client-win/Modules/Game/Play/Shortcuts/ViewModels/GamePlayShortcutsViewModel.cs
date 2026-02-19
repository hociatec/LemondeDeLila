using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows.Input;
using client_win.Core.Input;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;

namespace client_win.Modules.Game.Play.Shortcuts.ViewModels;

internal sealed class GamePlayShortcutsViewModel
{
    private readonly ICommand _sendKey;
    private readonly ICommand _turnInfo;
    private const string TurnShortcutCode = "ui.turn";

    public GamePlayShortcutsViewModel(ICommand sendKey, ICommand turnInfo)
    {
        _sendKey = sendKey ?? throw new ArgumentNullException(nameof(sendKey));
        _turnInfo = turnInfo ?? throw new ArgumentNullException(nameof(turnInfo));
    }

    public ObservableCollection<ShortcutDefinition> Shortcuts { get; } = new();

    public void InitializeStaticShortcuts(params ShortcutDefinition[] definitions)
    {
        Shortcuts.Clear();
        foreach (var definition in definitions.Where(d => d != null))
        {
            Shortcuts.Add(definition);
        }
    }

    public void SyncFromState(GameStateDto state)
    {
        if (state == null)
        {
            return;
        }

        var desired = new Dictionary<string, ShortcutDefinition>(StringComparer.OrdinalIgnoreCase);
        var hints = GamePlayExtrasParser.ExtractShortcutHints(state);
        foreach (var hint in hints)
        {
            if (!TryParseShortcutKey(hint, out var keyChar, out var gesture, out var normalizedKey))
            {
                continue;
            }

            var code = $"server.key.{normalizedKey}".ToLowerInvariant();
            if (desired.ContainsKey(code))
            {
                continue;
            }

            desired[code] = gesture != null
                ? new ShortcutDefinition(
                    gesture,
                    _sendKey,
                    commandParameter: normalizedKey,
                    description: "Raccourci serveur",
                    code: code,
                    availableInGame: true)
                : new ShortcutDefinition(
                    keyChar,
                    _sendKey,
                    commandParameter: normalizedKey,
                    description: "Raccourci serveur",
                    code: code,
                    availableInGame: true);
        }

        // Remove old server.key.* shortcuts.
        for (var i = Shortcuts.Count - 1; i >= 0; i--)
        {
            var code = Shortcuts[i].Code ?? string.Empty;
            if (!code.StartsWith("server.key.", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (!desired.ContainsKey(code))
            {
                Shortcuts.RemoveAt(i);
            }
        }

        // Upsert desired shortcuts.
        foreach (var kv in desired)
        {
            var existing = FindShortcutByCode(kv.Key);
            if (existing != null)
            {
                var next = kv.Value;
                if (existing.Key == next.Key &&
                    Equals(existing.CommandParameter, next.CommandParameter))
                {
                    continue;
                }
                Shortcuts.Remove(existing);
            }

            Shortcuts.Add(kv.Value);
        }

        SyncGenericTurnShortcut(hasServerTurnShortcut: desired.ContainsKey("server.key.t"));
    }

    private ShortcutDefinition? FindShortcutByCode(string code)
    {
        foreach (var shortcut in Shortcuts)
        {
            if (string.Equals(shortcut.Code, code, StringComparison.OrdinalIgnoreCase))
            {
                return shortcut;
            }
        }

        return null;
    }

    private static bool TryParseShortcutKey(
        GamePlayExtrasParser.ShortcutHint? hint,
        out char keyChar,
        out KeyGesture? gesture,
        out string normalizedKey)
    {
        keyChar = default;
        gesture = null;
        normalizedKey = string.Empty;

        if (hint == null)
        {
            return false;
        }

        var s = hint.Key ?? string.Empty;
        const string prefix = "pressed ";
        if (s.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            s = s.Substring(prefix.Length).Trim();
        }

        if (s.Length == 1 && char.IsLetter(s[0]))
        {
            keyChar = char.ToLowerInvariant(s[0]);
            normalizedKey = char.ToUpperInvariant(s[0]).ToString();
            return true;
        }

        // Zig et Zag: allow SPACE for draw_card (server-side shortcut).
        // We keep this narrow to avoid conflicting with GamePlayView root key forwarding for common keys
        // (Enter/Space) in other games/views (grid/buttons, choices lists, etc.).
        if (string.Equals(hint.Type, "action", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(hint.ActionType, "draw_card", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(s, "SPACE", StringComparison.OrdinalIgnoreCase))
        {
            gesture = new KeyGesture(Key.Space);
            normalizedKey = "SPACE";
            return true;
        }

        return false;
    }

    private void SyncGenericTurnShortcut(bool hasServerTurnShortcut)
    {
        var existing = FindShortcutByCode(TurnShortcutCode);
        if (hasServerTurnShortcut)
        {
            if (existing != null)
            {
                Shortcuts.Remove(existing);
            }
            return;
        }

        if (existing != null)
        {
            return;
        }

        Shortcuts.Add(new ShortcutDefinition(
            key: 't',
            command: _turnInfo,
            description: "Annoncer à qui est le tour",
            code: TurnShortcutCode,
            availableInGame: true));
    }
}
 
