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

        return raw
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim())
            .ToList();
    }
}

