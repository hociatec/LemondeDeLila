using System;
using System.Collections.Generic;
using System.Linq;
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

        if (!string.IsNullOrWhiteSpace(pending.Label))
        {
            return pending.Label.Trim();
        }

        if (!string.IsNullOrWhiteSpace(pending.Question))
        {
            return pending.Question.Trim();
        }

        var type = (pending.Type ?? string.Empty).Trim();
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
            .Select(c => c.Trim())
            .ToList();

        // Accessibilité: si plusieurs lignes ont le même texte ("3", "3", "3"),
        // certains lecteurs d'écran n'annoncent pas toujours le changement de sélection.
        // On rend ces lignes uniques avec des caractères invisibles (U+2060 WORD JOINER),
        // sans modifier l'affichage.
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
