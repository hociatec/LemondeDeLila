using System;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomAnnouncements : IRoomAnnouncements
{
    public event Action<RoomAnnouncement>? Announced;

    public void BotJoined(string botName)
    {
        if (string.IsNullOrWhiteSpace(botName)) return;
        var message = $"{botName} a rejoint la table.";
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void BotLeft(string botName)
    {
        if (string.IsNullOrWhiteSpace(botName)) return;
        var message = $"{botName} a quitté la table.";
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void PlayerJoined(string username, bool spectator)
    {
        if (string.IsNullOrWhiteSpace(username)) return;
        var role = spectator ? " (spectateur)" : string.Empty;
        var message = $"{username.Trim()} a rejoint la table{role}.";
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void PlayerLeft(string username, bool spectator)
    {
        if (string.IsNullOrWhiteSpace(username)) return;
        var role = spectator ? " (spectateur)" : string.Empty;
        var message = $"{username.Trim()} a quitté la table{role}.";
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void OwnerChanged(string username)
    {
        var name = (username ?? string.Empty).Trim();
        var message = name.Length == 0 ? "Propriétaire : aucun." : $"Nouveau propriétaire : {name}.";
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void PlayersList(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void TableInfo(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void VisibilityChanged(bool isPrivate)
    {
        var message = isPrivate ? "Table privée." : "Table publique.";
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void RoleChanged(bool isSpectator)
    {
        var message = isSpectator ? "Mode spectateur." : "Mode joueur.";
        Announced?.Invoke(new(RoomAnnouncementKind.Polite, message));
    }

    public void Error(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        // IMPORTANT:
        // Les erreurs sont déjà ajoutées à l'historique (via Announced -> HistorySink) et annoncées depuis l'historique.
        // Si on annonce aussi ici, certains lecteurs d'écran lisent en double.
        Announced?.Invoke(new(RoomAnnouncementKind.Assertive, message));
    }
}
