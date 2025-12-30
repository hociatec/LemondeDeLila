using System;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomAnnouncements : IRoomAnnouncements
{
    private readonly IScreenReaderAnnouncer _announcer;

    public RoomAnnouncements(IScreenReaderAnnouncer announcer)
    {
        _announcer = announcer ?? throw new ArgumentNullException(nameof(announcer));
    }

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

    public void ShortcutKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        _announcer.AnnounceAssertive(key);
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
