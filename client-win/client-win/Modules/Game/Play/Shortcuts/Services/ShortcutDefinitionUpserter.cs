using System;
using System.Collections.ObjectModel;
using client_win.Core.Input;

namespace client_win.Modules.Game.Play.Shortcuts.Services;

internal sealed class ShortcutDefinitionUpserter
{
    private readonly ObservableCollection<ShortcutDefinition> _shortcuts;

    internal ShortcutDefinitionUpserter(ObservableCollection<ShortcutDefinition> shortcuts)
    {
        _shortcuts = shortcuts ?? throw new ArgumentNullException(nameof(shortcuts));
    }

    internal void UpsertOrRemove(string code, bool supported, Func<ShortcutDefinition> create)
    {
        var existing = FindByCode(code);

        if (!supported)
        {
            if (existing != null)
            {
                _shortcuts.Remove(existing);
            }
            return;
        }

        if (existing != null)
        {
            return;
        }

        _shortcuts.Add(create());
    }

    private ShortcutDefinition? FindByCode(string code)
    {
        foreach (var shortcut in _shortcuts)
        {
            if (string.Equals(shortcut.Code, code, StringComparison.OrdinalIgnoreCase))
            {
                return shortcut;
            }
        }
        return null;
    }
}
