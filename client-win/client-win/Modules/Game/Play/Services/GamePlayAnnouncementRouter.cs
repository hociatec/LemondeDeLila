using System;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.Services;

internal sealed class GamePlayAnnouncementRouter
{
    private readonly IGameAnnouncements? _announcements;
    private string? _lastTurnAnnouncement;
    private DateTime _lastTurnAnnouncementAtUtc;
    private string? _lastInfoAnnouncement;
    private DateTime _lastInfoAnnouncementAtUtc;

    internal GamePlayAnnouncementRouter(IGameAnnouncements? announcements)
    {
        _announcements = announcements;
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

    internal void TryAnnounceLogMessage(string? message)
    {
        if (_announcements == null)
        {
            return;
        }

        if (!ShouldAnnounceLogMessage(message))
        {
            return;
        }

        var msg = message!.Trim();
        var now = DateTime.UtcNow;
        if (string.Equals(_lastInfoAnnouncement, msg, StringComparison.Ordinal) &&
            (now - _lastInfoAnnouncementAtUtc) < TimeSpan.FromSeconds(1))
        {
            return;
        }

        _lastInfoAnnouncement = msg;
        _lastInfoAnnouncementAtUtc = now;
        _announcements.Info(msg);
    }

    private static bool ShouldAnnounceLogMessage(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        var msg = message.Trim();

        // Le tour est annoncé via `game.turn` (pas via les logs) pour éviter les doublons.
        if (msg.StartsWith("C'est au tour de", StringComparison.OrdinalIgnoreCase) ||
            msg.StartsWith("Tour actuel", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        // Par défaut on annonce toutes les nouvelles lignes de log: elles arrivent dans l'historique
        // et doivent être accessibles sans déplacer le focus.
        return true;
    }
}
