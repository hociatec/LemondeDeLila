using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Services;

public sealed class GameHistorySink : IGameHistorySink
{
    private readonly Dispatcher _dispatcher;
    private readonly GameHistoryViewModel _history;
    private readonly IAnnouncementService? _announcements;
    private string? _lastMessage;
    private DateTime _lastMessageAtUtc;
    private readonly List<(string Key, DateTime AtUtc)> _recentDedupe = new();
    private static readonly TimeSpan RecentDedupeWindow = TimeSpan.FromSeconds(10);

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

                if (ShouldSkipDuplicate(cleaned))
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
        if (flushPending)
        {
            // When the user triggers an interface shortcut, prefer the related information immediately.
            // This avoids replaying stale queued announcements before the shortcut message.
            _announcements.CancelPending(cancelSpeech: true);
        }
        _announcements.Enqueue(normalized, priority);
        return true;
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

    private bool ShouldSkipDuplicate(string cleaned)
    {
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return true;
        }

        var now = DateTime.UtcNow;
        var key = BuildDedupeKey(cleaned);
        if (!string.IsNullOrWhiteSpace(key))
        {
            _recentDedupe.RemoveAll(e => now - e.AtUtc > RecentDedupeWindow);
            if (_recentDedupe.Any(e => string.Equals(e.Key, key, StringComparison.Ordinal)))
            {
                return true;
            }
            _recentDedupe.Add((key, now));
        }

        if (_lastMessage != null &&
            string.Equals(_lastMessage, cleaned, StringComparison.Ordinal) &&
            now - _lastMessageAtUtc < TimeSpan.FromSeconds(2))
        {
            return true;
        }

        _lastMessage = cleaned;
        _lastMessageAtUtc = now;
        return false;
    }

    private static string? BuildDedupeKey(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return null;
        }

        var normalized = message.Trim();
        var lower = normalized.ToLowerInvariant();

        if (lower.StartsWith("table de ", StringComparison.Ordinal) ||
            lower.StartsWith("table créée", StringComparison.Ordinal) ||
            lower.StartsWith("table demarree", StringComparison.Ordinal) ||
            lower.StartsWith("table démarrée", StringComparison.Ordinal))
        {
            return NormalizeDedupeText(normalized);
        }

        if (lower.StartsWith("c'est à ", StringComparison.Ordinal) &&
            lower.Contains(" de jouer", StringComparison.Ordinal))
        {
            return NormalizeDedupeText(normalized);
        }

        return null;
    }

    private static string NormalizeDedupeText(string message)
    {
        var cleaned = (message ?? string.Empty).Trim();
        cleaned = cleaned.Replace("(Entrée)", string.Empty, StringComparison.OrdinalIgnoreCase)
                         .Replace("(entrée)", string.Empty, StringComparison.OrdinalIgnoreCase);
        cleaned = cleaned.Trim().TrimEnd('.', '!', '?');

        var parts = cleaned
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length == 0 ? string.Empty : string.Join(' ', parts).ToLowerInvariant();
    }
}
