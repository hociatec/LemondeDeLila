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
    private string? _lastTurnMessageKey;
    private DateTime _lastTurnMessageAtUtc;
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
                var isUi = trimmed.StartsWith("[ui]", StringComparison.OrdinalIgnoreCase);
                var isUiTurn = trimmed.StartsWith("[ui.turn]", StringComparison.OrdinalIgnoreCase);
                var isUiShortcutTagged = trimmed.StartsWith("[ui.shortcut]", StringComparison.OrdinalIgnoreCase);
                var isUiShortcut = isUi || isUiTurn || isUiShortcutTagged;
                var cleaned = RemoveInvisibleFormattingChars(StripGamePrefix(trimmed));
                if (string.IsNullOrWhiteSpace(cleaned))
                {
                    continue;
                }

                // Les raccourcis utilisateur explicites ([ui.shortcut]) doivent toujours être rejoués
                // même si le texte est identique (ex: spam volontaire de "T" pour réécouter le tour).
                if (!isUiShortcutTagged && ShouldSkipDuplicate(cleaned))
                {
                    continue;
                }

                _history.Entries.Add(cleaned);

                TryAnnounce(
                    cleaned,
                    timestamp,
                    priority: isUiShortcut ? AnnouncementPriority.Assertive : AnnouncementPriority.Polite,
                    flushPending: isUi);
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
            _announcements.CancelPending(cancelSpeech: false);
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
        var trimmed = RemoveInvisibleFormattingChars((message ?? string.Empty).Trim());
        return string.IsNullOrWhiteSpace(trimmed) ? string.Empty : trimmed;
    }

    private static string RemoveInvisibleFormattingChars(string? input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return string.Empty;
        }

        return (input ?? string.Empty)
            .Replace("\u2060", string.Empty, StringComparison.Ordinal) // WORD JOINER
            .Replace("\u200B", string.Empty, StringComparison.Ordinal) // ZERO WIDTH SPACE
            .Replace("\u200C", string.Empty, StringComparison.Ordinal) // ZERO WIDTH NON-JOINER
            .Replace("\u200D", string.Empty, StringComparison.Ordinal) // ZERO WIDTH JOINER
            .Replace("\uFEFF", string.Empty, StringComparison.Ordinal) // ZERO WIDTH NO-BREAK SPACE / BOM
            .Trim();
    }

    private bool ShouldSkipDuplicate(string cleaned)
    {
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return true;
        }

        var now = DateTime.UtcNow;
        if (TryBuildTurnDedupeKey(cleaned, out var turnKey))
        {
            if (_lastTurnMessageKey != null &&
                string.Equals(_lastTurnMessageKey, turnKey, StringComparison.Ordinal) &&
                now - _lastTurnMessageAtUtc < TimeSpan.FromSeconds(3))
            {
                return true;
            }

            _lastTurnMessageKey = turnKey;
            _lastTurnMessageAtUtc = now;
        }

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

        return null;
    }

    private static bool TryBuildTurnDedupeKey(string message, out string key)
    {
        key = string.Empty;
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        var text = message.Trim();
        string? actor = null;

        const string turnPrefix = "C'est au tour de ";
        if (text.StartsWith(turnPrefix, StringComparison.OrdinalIgnoreCase))
        {
            actor = text.Substring(turnPrefix.Length).Trim();
        }
        else if (text.StartsWith("C'est à ", StringComparison.OrdinalIgnoreCase))
        {
            var suffixIndex = text.IndexOf(" de jouer", StringComparison.OrdinalIgnoreCase);
            if (suffixIndex > 7)
            {
                actor = text.Substring("C'est à ".Length, suffixIndex - "C'est à ".Length).Trim();
            }
        }
        else if (text.StartsWith("Tour de ", StringComparison.OrdinalIgnoreCase))
        {
            actor = text.Substring("Tour de ".Length).Trim();
        }

        if (string.IsNullOrWhiteSpace(actor))
        {
            return false;
        }

        actor = actor.Trim().TrimEnd('.', '!', '?', ';', ':');
        actor = StripGameZoneSuffix(actor);
        var canonicalActor = NormalizeDedupeText(actor);
        if (string.IsNullOrWhiteSpace(canonicalActor))
        {
            return false;
        }

        key = $"turn|{canonicalActor}";
        return true;
    }

    private static string StripGameZoneSuffix(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return string.Empty;
        }

        var cleaned = name.Trim();
        var lowered = cleaned.ToLowerInvariant();
        if (lowered.EndsWith("(zone de jeu)", StringComparison.Ordinal) ||
            lowered.EndsWith("(zone de jeux)", StringComparison.Ordinal) ||
            lowered.EndsWith("(game zone)", StringComparison.Ordinal))
        {
            var openParen = cleaned.LastIndexOf('(');
            if (openParen > 0)
            {
                cleaned = cleaned.Substring(0, openParen).TrimEnd();
            }
        }
        else if (lowered.EndsWith(" zone de jeu", StringComparison.Ordinal))
        {
            cleaned = cleaned.Substring(0, cleaned.Length - " zone de jeu".Length).TrimEnd();
        }
        else if (lowered.EndsWith(" zone de jeux", StringComparison.Ordinal))
        {
            cleaned = cleaned.Substring(0, cleaned.Length - " zone de jeux".Length).TrimEnd();
        }
        else if (lowered.EndsWith(" game zone", StringComparison.Ordinal))
        {
            cleaned = cleaned.Substring(0, cleaned.Length - " game zone".Length).TrimEnd();
        }

        return cleaned;
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
