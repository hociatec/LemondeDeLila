using System;
using System.Collections.Generic;
using client_win.Modules.Game.Play.Actions.Dtos;

namespace client_win.Modules.Game.Play.Choices.Services;

internal static class ChoiceLabelUniquifier
{
    internal static string MakeUniqueChoiceLabel(Dictionary<string, GameClientAction> existing, string label)
    {
        var baseLabel = (label ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(baseLabel))
        {
            baseLabel = "Choix";
        }

        if (!existing.ContainsKey(baseLabel))
        {
            return baseLabel;
        }

        var n = 1;
        while (true)
        {
            n++;
            var next = $"{baseLabel} ({n})";
            if (!existing.ContainsKey(next))
            {
                return next;
            }
        }
    }
}

