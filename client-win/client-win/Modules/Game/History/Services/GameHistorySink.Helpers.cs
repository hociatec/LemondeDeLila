using System;
using System.Linq;
using client_win.Core.Text;
using client_win.Modules.Game.Common;

namespace client_win.Modules.Game.History.Services;

public partial class GameHistorySink
{
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
        var hasLetter = tag.Any(char.IsLetter);
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
            .Replace("\u2060", string.Empty, StringComparison.Ordinal)
            .Replace("\u200B", string.Empty, StringComparison.Ordinal)
            .Replace("\u200C", string.Empty, StringComparison.Ordinal)
            .Replace("\u200D", string.Empty, StringComparison.Ordinal)
            .Replace("\uFEFF", string.Empty, StringComparison.Ordinal)
            .Trim();
    }

    private bool ShouldSkipDuplicate(string cleaned, string? timestamp)
    {
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return true;
        }

        var now = DateTime.UtcNow;

        // When the server provides a timestamp, it is a stable identifier for that log entry
        // across full-state replays / reconnects. Dedupe strictly on (timestamp + message).
        var ts = (timestamp ?? string.Empty).Trim();
        if (ts.Length > 0)
        {
            var tsKey = $"ts|{ts}|{cleaned}";
            if (_timestampDedupeSeen.Contains(tsKey))
            {
                return true;
            }

            _timestampDedupeSeen.Add(tsKey);
            _timestampDedupeOrder.Enqueue(tsKey);
            while (_timestampDedupeOrder.Count > TimestampDedupeMaxKeys)
            {
                var old = _timestampDedupeOrder.Dequeue();
                _timestampDedupeSeen.Remove(old);
            }
        }
        if (TryBuildTurnDedupeKey(cleaned, out var turnKey))
        {
            if (_lastTurnMessageKey != null &&
                string.Equals(_lastTurnMessageKey, turnKey, StringComparison.Ordinal) &&
                now - _lastTurnMessageAtUtc < GameTiming.History.TurnDedupeWindow)
            {
                return true;
            }

            _lastTurnMessageKey = turnKey;
            _lastTurnMessageAtUtc = now;
        }

        var key = BuildDedupeKey(cleaned);
        if (!string.IsNullOrWhiteSpace(key))
        {
            if (key.StartsWith("session|", StringComparison.Ordinal))
            {
                // New game/session delimiter: allow "strong" messages again.
                _strongDedupeSeen.Clear();
                _strongDedupeOrder.Clear();
                _timestampDedupeSeen.Clear();
                _timestampDedupeOrder.Clear();
                _recentDedupe.Clear();
            }

            if (key.StartsWith("strong|", StringComparison.Ordinal))
            {
                if (_strongDedupeSeen.Contains(key))
                {
                    return true;
                }

                _strongDedupeSeen.Add(key);
                _strongDedupeOrder.Enqueue(key);
                while (_strongDedupeOrder.Count > StrongDedupeMaxKeys)
                {
                    var old = _strongDedupeOrder.Dequeue();
                    _strongDedupeSeen.Remove(old);
                }
            }

            _recentDedupe.RemoveAll(e => now - e.AtUtc > RecentDedupeWindow);
            if (_recentDedupe.Any(e => string.Equals(e.Key, key, StringComparison.Ordinal)))
            {
                return true;
            }
            _recentDedupe.Add((key, now));
        }

        if (_lastMessage != null &&
            string.Equals(_lastMessage, cleaned, StringComparison.Ordinal) &&
            now - _lastMessageAtUtc < GameTiming.History.MessageDedupeWindow)
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

        // Strong-dedupe: these messages should not legitimately repeat during the same game session.
        // If we receive them again, it's usually due to replay/reconnect/state re-emission.
        if (lower.StartsWith("positions.", StringComparison.Ordinal) ||
            lower.Contains(" choisit ", StringComparison.Ordinal) ||
            lower.Contains(" se deplace de ", StringComparison.Ordinal) ||
            lower.Contains(" se déplace de ", StringComparison.Ordinal) ||
            lower.Contains(" place un mur ", StringComparison.Ordinal) ||
            lower.StartsWith("victoire de ", StringComparison.Ordinal) ||
            lower.StartsWith("match nul", StringComparison.Ordinal) ||
            lower.StartsWith("partie termin", StringComparison.Ordinal))
        {
            return $"strong|{NormalizeDedupeText(normalized)}";
        }


        if (lower.StartsWith("table de ", StringComparison.Ordinal) ||
            lower.StartsWith("table créée", StringComparison.Ordinal) ||
            lower.StartsWith("table demarree", StringComparison.Ordinal) ||
            lower.StartsWith("table démarrée", StringComparison.Ordinal))
        {
            // Session boundary marker (used to reset strong dedupe sets).
            return $"session|{NormalizeDedupeText(normalized)}";
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
