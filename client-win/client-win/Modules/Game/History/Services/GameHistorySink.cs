using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Services;

public sealed class GameHistorySink : IGameHistorySink
{
    private static readonly TimeSpan AnnouncementDedupWindow = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan CleanupThreshold = TimeSpan.FromMinutes(5);

    private readonly Dispatcher _dispatcher;
    private readonly GameHistoryViewModel _history;
    private readonly IAnnouncementService? _announcements;
    private readonly Dictionary<string, DateTime> _lastAnnouncements = new(StringComparer.OrdinalIgnoreCase);

    public GameHistorySink(Dispatcher dispatcher, GameHistoryViewModel history, IAnnouncementService? announcements = null)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _history = history ?? throw new ArgumentNullException(nameof(history));
        _announcements = announcements;
    }

    public void Add(string message, string? timestamp = null)
    {
        var parts = GameHistoryMessageSplitter.Split(message);
        if (parts.Count == 0)
        {
            return;
        }

        void AddNow()
        {
            foreach (var part in parts)
            {
                var raw = part ?? string.Empty;
                if (raw == GameHistoryMessageSplitter.BlankLineToken)
                {
                    _history.Entries.Add(raw);
                    continue;
                }

                var trimmed = raw.Trim();
                var isUiShortcut = trimmed.StartsWith("[ui]", StringComparison.OrdinalIgnoreCase);
                var cleaned = StripGamePrefix(trimmed);
                if (string.IsNullOrWhiteSpace(cleaned))
                {
                    continue;
                }

                _history.Entries.Add(cleaned);

                TryAnnounce(
                    cleaned,
                    timestamp,
                    priority: isUiShortcut ? AnnouncementPriority.Assertive : AnnouncementPriority.Polite,
                    flushPending: isUiShortcut);
            }
        }

        // IMPORTANT:
        // Si on est déjà sur le thread UI (cas normal: update de game.state),
        // ajouter immédiatement pour préserver l'ordre des annonces (historique avant interface).
        if (_dispatcher.CheckAccess())
        {
            AddNow();
        }
        else
        {
            _dispatcher.InvokeAsync(AddNow, DispatcherPriority.Background);
        }
    }

    public void AddChat(string message)
    {
        // Le tchat doit rester sur une seule ligne (ne pas découper en phrases),
        // et éviter la double lecture NVDA (le contrôle d'historique suffit).
        var cleaned = NormalizeSingleLine(message);
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return;
        }

        void AddNow()
        {
            _history.Entries.Add(cleaned);
        }

        if (_dispatcher.CheckAccess())
        {
            AddNow();
        }
        else
        {
            _dispatcher.InvokeAsync(AddNow, DispatcherPriority.Background);
        }
    }

    private bool TryAnnounce(
        string message,
        string? timestamp,
        AnnouncementPriority priority,
        bool flushPending)
    {
        if (_announcements == null)
        {
            return false;
        }

        var normalized = NormalizeAnnouncement(message);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return false;
        }

        var now = ParseTimestampOrNow(timestamp);
        // Interface shortcuts (ex: score/turn) should always announce, even if the message is identical
        // within the dedup window. `flushPending` is used for UI shortcuts ([ui] prefix).
        if (!flushPending)
        {
            if (_lastAnnouncements.TryGetValue(normalized, out var last))
            {
                if (now <= last || now - last <= AnnouncementDedupWindow)
                {
                    return false;
                }
            }
        }

        if (_lastAnnouncements.Count > 512)
        {
            var cutoff = DateTime.UtcNow - CleanupThreshold;
            foreach (var key in new List<string>(_lastAnnouncements.Keys))
            {
                if (_lastAnnouncements.TryGetValue(key, out var recorded) && recorded < cutoff)
                {
                    _lastAnnouncements.Remove(key);
                }
            }
        }

        _lastAnnouncements[normalized] = now;
        if (flushPending)
        {
            // When the user triggers an interface shortcut, prefer the related information immediately.
            // This avoids replaying stale queued announcements before the shortcut message.
            _announcements.CancelPending(cancelSpeech: true);
        }
        _announcements.Enqueue(normalized, priority);
        return true;
    }

    private static DateTime ParseTimestampOrNow(string? timestamp)
    {
        if (string.IsNullOrWhiteSpace(timestamp))
        {
            return DateTime.UtcNow;
        }

        if (DateTime.TryParse(timestamp, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed.ToUniversalTime();
        }

        return DateTime.UtcNow;
    }

    private static string NormalizeSingleLine(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        var normalized = (message ?? string.Empty)
            .Replace("\r\n", " ", StringComparison.Ordinal)
            .Replace('\r', ' ')
            .Replace('\n', ' ')
            .Trim();

        // Collapse whitespace to avoid weird wraps (NBSP, multiple spaces).
        var parts = normalized
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length == 0 ? string.Empty : string.Join(' ', parts);
    }

    private static string StripGamePrefix(string message)
    {
        if (string.IsNullOrWhiteSpace(message) || message.Length < 4)
        {
            return message;
        }

        // Beaucoup de jeux préfixent leurs logs pour debug : "[Panier Express] ...".
        // Pour l'accessibilité (annonces), on retire ce préfixe pour éviter de répéter le nom du jeu à chaque action.
        if (message[0] != '[')
        {
            return message;
        }

        var end = message.IndexOf(']');
        if (end < 2 || end > 40)
        {
            return message;
        }

        if (end + 1 >= message.Length || message[end + 1] != ' ')
        {
            return message;
        }

        var tag = message.Substring(1, end - 1);
        var hasLetter = false;
        foreach (var ch in tag)
        {
            if (char.IsLetter(ch))
            {
                hasLetter = true;
                break;
            }
        }
        if (!hasLetter)
        {
            return message;
        }

        return message.Substring(end + 2).Trim();
    }

    private static string NormalizeAnnouncement(string? message)
    {
        var trimmed = (message ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? string.Empty : trimmed;
    }
}
