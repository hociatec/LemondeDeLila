using System.Collections.Generic;
using System.Windows.Input;
using client_win.Core.Input;

namespace client_win.Modules.Game.Room.Input;

public static class RoomShortcuts
{
    public static IEnumerable<ShortcutDefinition> Create(
        ICommand addBotCommand,
        ICommand removeBotCommand,
        ICommand announcePlayersCommand,
        ICommand togglePrivacyCommand,
        ICommand toggleRoleCommand,
        ICommand quitCommand)
    {
        yield return new ShortcutDefinition(
            new KeyGesture(Key.M, ModifierKeys.Control),
            toggleRoleCommand,
            description: "Changer le mode joueur/spectateur");

        yield return new ShortcutDefinition(
            new KeyGesture(Key.H, ModifierKeys.Control),
            togglePrivacyCommand,
            description: "Changer la visibilité de la table");

        yield return new ShortcutDefinition(
            'w',
            announcePlayersCommand,
            description: "Lister les joueurs");

        yield return new ShortcutDefinition(
            'b',
            addBotCommand,
            description: "Ajouter un bot");

        yield return new ShortcutDefinition(
            'B',
            removeBotCommand,
            description: "Retirer un bot");

        yield return new ShortcutDefinition(
            'q',
            quitCommand,
            description: "Quitter la table");
    }
}
