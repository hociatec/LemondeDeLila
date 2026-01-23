using System.Collections.Generic;
using System.Windows.Input;
using client_win.Core.Input;

namespace client_win.Modules.Game.Room.Input;

public static class RoomShortcutCodes
{
    public const string Rules = "room.rules";
    public const string TableAmbience = "room.tableAmbience";
    public const string TableAmbienceVolume = "room.tableAmbienceVolume";
    public const string SaveSnapshot = "room.saveSnapshot";
    public const string Reset = "room.reset";
    public const string Info = "room.info";
    public const string ToggleRole = "room.toggleRole";
    public const string TogglePrivacy = "room.togglePrivacy";
    public const string Players = "room.players";
    public const string AddBot = "room.addBot";
    public const string RemoveBot = "room.removeBot";
    public const string Invite = "room.invite";
    public const string Kick = "room.kick";
    public const string Ban = "room.ban";
    public const string TransferOwner = "room.transferOwner";
    public const string Quit = "room.quit";
}

public static class RoomShortcuts
{
    // Quand une partie (room) est "started", le jeu peut utiliser des touches lettres (q, w, etc).
    // Ce flag permet de garder seulement certains raccourcis de "table" actifs pendant la partie.
    public static IEnumerable<ShortcutDefinition> Create(
        ICommand rulesCommand,
        ICommand tableAmbienceCommand,
        ICommand tableAmbienceVolumeCommand,
        ICommand saveSnapshotCommand,
        ICommand resetCommand,
        ICommand addBotCommand,
        ICommand removeBotCommand,
        ICommand announcePlayersCommand,
        ICommand announceInfoCommand,
        ICommand togglePrivacyCommand,
        ICommand toggleRoleCommand,
        ICommand inviteCommand,
        ICommand kickCommand,
        ICommand banCommand,
        ICommand transferOwnerCommand,
        ICommand quitCommand)
    {
        yield return new ShortcutDefinition(
            new KeyGesture(Key.R),
            rulesCommand,
            description: "Afficher les règles",
            code: RoomShortcutCodes.Rules,
            availableInGame: true);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.A, ModifierKeys.Control),
            tableAmbienceCommand,
            description: "Choisir l'ambiance de la table",
            code: RoomShortcutCodes.TableAmbience,
            availableInGame: true);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.V, ModifierKeys.Control),
            tableAmbienceVolumeCommand,
            description: "Volume ambiance de table (local)",
            code: RoomShortcutCodes.TableAmbienceVolume,
            availableInGame: true);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.S, ModifierKeys.Control),
            saveSnapshotCommand,
            description: "Sauvegarder la table (Mon coffre fort)",
            code: RoomShortcutCodes.SaveSnapshot,
            availableInGame: true);

        yield return new ShortcutDefinition(
            'x',
            resetCommand,
            description: "Réinitialiser la table",
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
            description: "Changer la visibilité de la table",
            code: RoomShortcutCodes.TogglePrivacy,
            availableInGame: true);

        yield return new ShortcutDefinition(
            'w',
            announcePlayersCommand,
            description: "Lister les joueurs",
            code: RoomShortcutCodes.Players,
            availableInGame: true);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.I, ModifierKeys.Control),
            inviteCommand,
            description: "Inviter un joueur",
            code: RoomShortcutCodes.Invite,
            availableInGame: true);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.K, ModifierKeys.Control),
            kickCommand,
            description: "Exclure un joueur de la table",
            code: RoomShortcutCodes.Kick,
            availableInGame: true);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.B, ModifierKeys.Control),
            banCommand,
            description: "Bannir un joueur de la table",
            code: RoomShortcutCodes.Ban,
            availableInGame: true);

        yield return new ShortcutDefinition(
            new KeyGesture(Key.P, ModifierKeys.Control),
            transferOwnerCommand,
            description: "Changer le propriétaire de la table",
            code: RoomShortcutCodes.TransferOwner,
            availableInGame: true);

        yield return new ShortcutDefinition(
            'b',
            addBotCommand,
            description: "Ajouter un bot (hors partie)",
            code: RoomShortcutCodes.AddBot,
            availableInGame: false);

        yield return new ShortcutDefinition(
            'B',
            removeBotCommand,
            description: "Retirer un bot (hors partie)",
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
