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

    public void BotJoined(string botName)
    {
        if (string.IsNullOrWhiteSpace(botName)) return;
        _announcer.AnnouncePolite($"{botName} a rejoint la table.");
    }

    public void BotLeft(string botName)
    {
        if (string.IsNullOrWhiteSpace(botName)) return;
        _announcer.AnnouncePolite($"{botName} a quitté la table.");
    }

    public void ShortcutKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        _announcer.AnnounceAssertive(key);
    }

    public void PlayersList(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        _announcer.AnnouncePolite(message);
    }

    public void VisibilityChanged(bool isPrivate)
    {
        _announcer.AnnouncePolite(isPrivate ? "Table privée." : "Table publique.");
    }

    public void RoleChanged(bool isSpectator)
    {
        _announcer.AnnouncePolite(isSpectator ? "Mode spectateur." : "Mode joueur.");
    }

    public void Error(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        _announcer.AnnounceAssertive(message);
    }
}
