using System;
using System.Collections.Generic;
using System.Linq;
using client_win.Core.Text;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Choices.Services;

internal static class PendingChoicesReader
{
    internal static string BuildServerChoicesLabel(GamePendingDto? pending)
    {
        if (pending == null)
        {
            return string.Empty;
        }

        var type = (pending.Type ?? string.Empty).Trim();
        if (type.StartsWith("lama_", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        if (!string.IsNullOrWhiteSpace(pending.Label))
        {
            return MojibakeTextRepair.Fix(pending.Label).Trim();
        }

        if (!string.IsNullOrWhiteSpace(pending.Question))
        {
            return MojibakeTextRepair.Fix(pending.Question).Trim();
        }

        if (string.Equals(type, "quiz", StringComparison.OrdinalIgnoreCase))
        {
            return "R\u00E9ponses";
        }
        return string.IsNullOrWhiteSpace(type) ? string.Empty : $"En attente: {type}";
    }

    internal static List<string> ExtractServerPendingChoices(GameStateDto state)
    {
        var raw = state.Pending?.Choices;
        if (raw == null || raw.Count == 0)
        {
            return new List<string>();
        }

        var choices = raw
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => MojibakeTextRepair.Fix(c).Trim())
            .ToList();

        // Accessibility: if multiple rows share the same text ("3", "3", "3"),
        // some screen readers may skip announcing selection changes.
        // Make rows unique with invisible characters (U+2060 WORD JOINER),
        // without changing the visible text.
        return MakeA11yDistinct(choices);
    }

    private static List<string> MakeA11yDistinct(List<string> choices)
    {
        if (choices == null || choices.Count <= 1)
        {
            return choices ?? new List<string>();
        }

        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var c in choices)
        {
            counts[c] = (counts.TryGetValue(c, out var n) ? n : 0) + 1;
        }

        var hasDuplicates = counts.Values.Any(v => v > 1);
        if (!hasDuplicates)
        {
            return choices;
        }

        var seen = new Dictionary<string, int>(StringComparer.Ordinal);
        var outList = new List<string>(choices.Count);
        foreach (var c in choices)
        {
            if (!counts.TryGetValue(c, out var total) || total <= 1)
            {
                outList.Add(c);
                continue;
            }

            var index = (seen.TryGetValue(c, out var n) ? n : 0) + 1;
            seen[c] = index;

            // NOTE: invisible; keeps the UI text identical.
            outList.Add(c + new string('\u2060', index));
        }

        return outList;
    }
}
