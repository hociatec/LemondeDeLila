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

    public GamePlayShortcutsViewModel(ICommand sendKey)
    {
        _sendKey = sendKey ?? throw new ArgumentNullException(nameof(sendKey));
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
            if (!TryParseShortcutKey(hint.Key, out var keyChar, out var normalizedKey))
            {
                continue;
            }

            var code = $"server.key.{normalizedKey}".ToLowerInvariant();
            if (desired.ContainsKey(code))
            {
                continue;
            }

            desired[code] = new ShortcutDefinition(
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

    private static bool TryParseShortcutKey(string? raw, out char keyChar, out string normalizedKey)
    {
        keyChar = default;
        normalizedKey = string.Empty;

        var s = raw ?? string.Empty;
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

        return false;
    }
}

