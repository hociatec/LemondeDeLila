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

        var who = NormalizePlayerName(info.CurrentPlayerUsername);
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

    private static string? NormalizePlayerName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var name = raw.Trim();
        var lowered = name.ToLowerInvariant();
        if (lowered.Contains("(zone de jeu)") ||
            lowered.Contains("(zone de jeux)") ||
            lowered.Contains("(game zone)"))
        {
            var openParen = name.LastIndexOf('(');
            if (openParen > 0)
            {
                name = name.Substring(0, openParen).TrimEnd();
            }
        }

        name = name.TrimEnd('.', ',', ';', ':', '!', '?', ')', ']');

        return string.IsNullOrWhiteSpace(name) ? null : name;
    }
}
