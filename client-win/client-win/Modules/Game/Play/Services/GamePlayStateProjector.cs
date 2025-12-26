using System;
using System.Collections.Generic;
using System.Linq;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.Services;

internal sealed class GamePlayStateProjector
{
    private int _lastSeenLogCount;

    internal void ResetLogCursor() => _lastSeenLogCount = 0;

    internal (List<string> choices, string? selected) ExtractPendingChoices(GameStateDto state)
    {
        var result = new List<string>();
        var raw = state.Pending?.Choices;
        if (raw == null || raw.Count == 0)
        {
            return (result, null);
        }

        foreach (var choice in raw.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()))
        {
            result.Add(choice);
        }

        return (result, result.Count > 0 ? result[0] : null);
    }

    internal IEnumerable<string> ExtractNewLogMessages(GameStateDto state)
    {
        var log = state.Log ?? new List<GameLogEntryDto>();
        if (log.Count == 0)
        {
            _lastSeenLogCount = 0;
            yield break;
        }

        if (_lastSeenLogCount < 0)
        {
            _lastSeenLogCount = 0;
        }

        if (log.Count < _lastSeenLogCount)
        {
            _lastSeenLogCount = 0;
        }

        var startIndex = _lastSeenLogCount;
        if (startIndex < 0) startIndex = 0;
        if (startIndex > log.Count) startIndex = log.Count;

        for (var i = startIndex; i < log.Count; i++)
        {
            var msg = NormalizeGameLogMessage(log[i]?.Message);
            if (!string.IsNullOrWhiteSpace(msg))
            {
                yield return msg;
            }
        }

        _lastSeenLogCount = log.Count;
    }

    internal bool HasInterfaceShortcut(GameStateDto? state, string id)
    {
        if (state == null) return false;
        if (string.IsNullOrWhiteSpace(id)) return false;
        return GamePlayExtrasParser.ExtractShortcutHints(state).Any(s =>
            string.Equals(s.Type, "interface", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizeGameLogMessage(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        var trimmed = message.Trim();

        if (trimmed.StartsWith("[", StringComparison.Ordinal) && trimmed.Contains(']'))
        {
            var idx = trimmed.IndexOf(']');
            if (idx >= 0 && idx + 1 <= trimmed.Length)
            {
                trimmed = trimmed[(idx + 1)..].TrimStart();
            }
        }

        return trimmed;
    }
}

