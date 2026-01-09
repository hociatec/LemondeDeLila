using System;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Announcements.Services;

internal sealed class GamePlayAnnouncementRouter
{
    private string? _lastTurnAnnouncement;
    private DateTime _lastTurnAnnouncementAtUtc;

    internal GamePlayAnnouncementRouter()
    {
    }

    internal bool TryHandleTurnUpdate(TurnInfoDto info, Action<string> emitHistoryMessage, bool force = false)
    {
        if (info == null)
        {
            return false;
        }

        var who = string.IsNullOrWhiteSpace(info.CurrentPlayerUsername) ? null : info.CurrentPlayerUsername.Trim();
        var msg = who == null
            ? "Tour actuel: inconnu."
            : $"C'est au tour de {who}.";

        var now = DateTime.UtcNow;
        if (!force &&
            string.Equals(_lastTurnAnnouncement, msg, StringComparison.Ordinal) &&
            (now - _lastTurnAnnouncementAtUtc) < TimeSpan.FromSeconds(1))
        {
            return false;
        }

        _lastTurnAnnouncement = msg;
        _lastTurnAnnouncementAtUtc = now;

        emitHistoryMessage(msg);
        return true;
    }
}
