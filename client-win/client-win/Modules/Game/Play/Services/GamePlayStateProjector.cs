using System;
using System.Collections.Generic;
using System.Linq;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.Services;

internal sealed class GamePlayStateProjector
{
    private int _lastSeenLogCount;
    private string? _lastSeenLogTimestamp;
    private string? _lastSeenLogKey;

    internal void ResetLogCursor()
    {
        _lastSeenLogCount = 0;
        _lastSeenLogTimestamp = null;
        _lastSeenLogKey = null;
    }

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
            yield break;
        }

        // Strategy:
        // - Prefer a stable cursor based on the last seen (timestamp + message) key.
        // - If the log payload is temporarily empty/truncated, do NOT reset the cursor
        //   (otherwise we replay the whole history and NVDA re-announces old messages).
        // - Fallback to timestamp ordering when the key is not found (ex: pruning).
        var lastSeenKey = _lastSeenLogKey;
        var lastSeenTs = _lastSeenLogTimestamp;

        var startIndex = 0;
        if (!string.IsNullOrWhiteSpace(lastSeenKey))
        {
            var idx = -1;
            for (var i = log.Count - 1; i >= 0; i--)
            {
                if (string.Equals(BuildLogKey(log[i]), lastSeenKey, StringComparison.Ordinal))
                {
                    idx = i;
                    break;
                }
            }

            if (idx >= 0)
            {
                startIndex = idx + 1;
            }
            else if (!string.IsNullOrWhiteSpace(lastSeenTs))
            {
                // If the exact key is not present (log pruned), only emit messages strictly newer
                // than the last seen timestamp (ISO-8601 string comparison is safe here).
                startIndex = log.Count;
                for (var i = 0; i < log.Count; i++)
                {
                    var ts = log[i]?.Timestamp;
                    if (!string.IsNullOrWhiteSpace(ts) &&
                        string.CompareOrdinal(ts, lastSeenTs) > 0)
                    {
                        startIndex = i;
                        break;
                    }
                }

                // If everything we received is older/equal, don't move the cursor backward.
                if (startIndex >= log.Count)
                {
                    yield break;
                }
            }
            else
            {
                // No usable timestamp: keep legacy behavior.
                startIndex = _lastSeenLogCount;
            }
        }
        else
        {
            startIndex = _lastSeenLogCount;
        }

        if (_lastSeenLogCount < 0)
        {
            _lastSeenLogCount = 0;
        }

        if (log.Count < _lastSeenLogCount)
        {
            // Log has been pruned; do not replay from the beginning.
            _lastSeenLogCount = log.Count;
        }

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
        var lastEntry = log[log.Count - 1];
        var tsLast = lastEntry?.Timestamp;
        if (!string.IsNullOrWhiteSpace(tsLast))
        {
            _lastSeenLogTimestamp = tsLast;
            _lastSeenLogKey = BuildLogKey(lastEntry);
        }
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

    private static string BuildLogKey(GameLogEntryDto? entry)
    {
        if (entry == null)
        {
            return string.Empty;
        }

        var ts = entry.Timestamp ?? string.Empty;
        var msg = NormalizeGameLogMessage(entry.Message);
        return $"{ts}|{msg}";
    }
}
