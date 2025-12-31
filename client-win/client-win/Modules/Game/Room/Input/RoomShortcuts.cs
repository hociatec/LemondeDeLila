using System.Collections.Generic;
using System.Windows.Input;
using client_win.Core.Input;

namespace client_win.Modules.Game.Room.Input;

public static class RoomShortcutCodes
{
    public const string Reset = "room.reset";
    public const string Info = "room.info";
    public const string ToggleRole = "room.toggleRole";
    public const string TogglePrivacy = "room.togglePrivacy";
    public const string Players = "room.players";
    public const string AddBot = "room.addBot";
    public const string RemoveBot = "room.removeBot";
    public const string Quit = "room.quit";
}

public static class RoomShortcuts
{
    // Quand une partie (room) est "started", le jeu peut utiliser des touches lettres (q, w, etc).
    // Ce flag permet de garder seulement certains raccourcis de "table" actifs pendant la partie.
    public static IEnumerable<ShortcutDefinition> Create(
        ICommand resetCommand,
        ICommand addBotCommand,
        ICommand removeBotCommand,
        ICommand announcePlayersCommand,
        ICommand announceInfoCommand,
        ICommand togglePrivacyCommand,
        ICommand toggleRoleCommand,
        ICommand quitCommand)
    {
        yield return new ShortcutDefinition(
            new KeyGesture(Key.Escape),
            quitCommand,
            description: "Retour menu précédent",
            code: RoomShortcutCodes.Quit,
            availableInGame: true);

        yield return new ShortcutDefinition(
            'x',
            resetCommand,
            description: "Reinitialiser la table",
            code: RoomShortcutCodes.Reset,
            availableInGame: true);

        yield return new ShortcutDefinition(
            'i',
            announceInfoCommand,
            description: "Informations table",
            code: RoomShortcutCodes.Info,
            availableInGame: false);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.M, ModifierKeys.Control),
            toggleRoleCommand,
            description: "Changer le mode joueur/spectateur",
            code: RoomShortcutCodes.ToggleRole,
            availableInGame: false);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.H, ModifierKeys.Control),
            togglePrivacyCommand,
            description: "Changer la visibilite de la table",
            code: RoomShortcutCodes.TogglePrivacy,
            availableInGame: true);

        yield return new ShortcutDefinition(
            'w',
            announcePlayersCommand,
            description: "Lister les joueurs",
            code: RoomShortcutCodes.Players,
            availableInGame: true);

        yield return new ShortcutDefinition(
            'b',
            addBotCommand,
            description: "Ajouter un bot",
            code: RoomShortcutCodes.AddBot,
            availableInGame: false);

        yield return new ShortcutDefinition(
            'B',
            removeBotCommand,
            description: "Retirer un bot",
            code: RoomShortcutCodes.RemoveBot,
            availableInGame: false);

        yield return new ShortcutDefinition(
            'q',
            quitCommand,
            description: "Quitter la table",
            code: RoomShortcutCodes.Quit,
            availableInGame: true);
    }
}
