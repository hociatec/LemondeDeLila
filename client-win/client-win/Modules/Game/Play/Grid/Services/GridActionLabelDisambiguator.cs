using System;
using System.Collections.Generic;

namespace client_win.Modules.Game.Play.Grid.Services;

internal static class GridActionLabelDisambiguator
{
    internal static IReadOnlyList<string> MakeUniqueLabels<T>(
        IReadOnlyList<T> actions,
        Func<T, string> getBaseLabel,
        out Dictionary<string, T> byLabel)
    {
        byLabel = new Dictionary<string, T>(StringComparer.Ordinal);
        var labels = new List<string>(actions.Count);
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var action in actions)
        {
            var baseLabel = (getBaseLabel(action) ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(baseLabel))
            {
                baseLabel = "Action";
            }

            counts.TryGetValue(baseLabel, out var n);
            n++;
            counts[baseLabel] = n;

            var label = n == 1 ? baseLabel : $"{baseLabel} ({n})";
            labels.Add(label);
            byLabel[label] = action;
        }

        return labels;
    }
}

