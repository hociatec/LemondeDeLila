using System;
using System.Collections.Generic;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal static class GamePlayLogRewriter
{
    internal static string RewriteForViewer(
        string message,
        string? viewerUsername,
        Dictionary<string, int>? previousHandCounts,
        Dictionary<string, int>? currentHandCounts)
    {
        var msg = (message ?? string.Empty).Trim();
        if (msg.Length == 0 || string.IsNullOrWhiteSpace(viewerUsername))
        {
            return msg;
        }

        var viewerName = viewerUsername.Trim();
        const string drawMarker = " pioche";
        var drawIndex = msg.IndexOf(drawMarker, StringComparison.OrdinalIgnoreCase);
        if (drawIndex > 0)
        {
            var actor = msg.Substring(0, drawIndex).Trim();
            if (!string.IsNullOrWhiteSpace(actor))
            {
                if (string.Equals(actor, viewerName, StringComparison.OrdinalIgnoreCase))
                {
                    if (string.Equals(msg, $"{actor} pioche.", StringComparison.OrdinalIgnoreCase))
                    {
                        var added = InferSingleAddedCard(previousHandCounts, currentHandCounts);
                        return added != null ? $"Vous piochez un {added}." : "Vous piochez.";
                    }

                    var remainder = msg.Substring(drawIndex + drawMarker.Length).Trim();
                    if (string.IsNullOrWhiteSpace(remainder) || string.Equals(remainder, ".", StringComparison.Ordinal))
                    {
                        return "Vous piochez.";
                    }
                    return $"Vous piochez {remainder}";
                }

                return msg;
            }
        }

        var user = viewerName;

        if (string.Equals(msg, $"{user} passe.", StringComparison.OrdinalIgnoreCase))
        {
            return "Vous passez.";
        }

        if (msg.StartsWith($"{user} se retire de la manche", StringComparison.OrdinalIgnoreCase))
        {
            return "Vous vous retirez de la manche. Vos jetons seront comptés à la fin de la manche.";
        }

        if (string.Equals(msg, $"{user} ne rend rien.", StringComparison.OrdinalIgnoreCase))
        {
            return "Vous ne rendez rien.";
        }

        var renderPrefix = $"{user} rend ";
        if (msg.StartsWith(renderPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return $"Vous rendez {msg.Substring(renderPrefix.Length).Trim()}";
        }

        var prefix = $"{user} joue un ";
        if (msg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            var card = msg.Substring(prefix.Length).Trim();
            return $"Vous jouez un {card}";
        }

        var playPrefix = $"{user} joue ";
        if (msg.StartsWith(playPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var card = msg.Substring(playPrefix.Length).Trim();
            return $"Vous jouez {card}";
        }

        var discardPrefix = $"{user} défausse ";
        if (msg.StartsWith(discardPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var card = msg.Substring(discardPrefix.Length).Trim();
            return $"Vous défaussez {card}";
        }

        return msg;
    }

    private static string? InferSingleAddedCard(
        Dictionary<string, int>? previousHandCounts,
        Dictionary<string, int>? currentHandCounts)
    {
        if (previousHandCounts == null || currentHandCounts == null)
        {
            return null;
        }

        string? added = null;
        foreach (var (label, current) in currentHandCounts)
        {
            var previous = previousHandCounts.TryGetValue(label, out var previousCount) ? previousCount : 0;
            if (current <= previous)
            {
                continue;
            }
            if (current - previous != 1)
            {
                return null;
            }
            if (added != null)
            {
                return null;
            }
            added = label;
        }

        return added;
    }
}

