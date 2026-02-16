using System;
using System.Collections.Generic;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.State.Services;

internal sealed class GameLogCursor
{
    private int _lastSeenLogCount;
    private string? _lastSeenLogTimestamp;
    private string? _lastSeenLogKey;

    internal void Reset()
    {
        _lastSeenLogCount = 0;
        _lastSeenLogTimestamp = null;
        _lastSeenLogKey = null;
    }

    internal void Prime(GameStateDto? state)
    {
        try
        {
            var log = state?.Log ?? new List<GameLogEntryDto>();
            if (log.Count <= 0)
            {
                Reset();
                return;
            }

            var replayIndex = ResolveReplayPromptIndex(state, log);
            if (replayIndex >= 0)
            {
                PrimeBeforeIndex(log, replayIndex);
                return;
            }

            _lastSeenLogCount = log.Count;
            var lastEntry = log[log.Count - 1];
            var tsLast = lastEntry?.Timestamp;
            _lastSeenLogTimestamp = string.IsNullOrWhiteSpace(tsLast) ? null : tsLast;
            _lastSeenLogKey = BuildLogKey(lastEntry);
        }
        catch
        {
            Reset();
        }
    }

    private void PrimeBeforeIndex(IReadOnlyList<GameLogEntryDto> log, int replayIndex)
    {
        if (replayIndex <= 0)
        {
            _lastSeenLogCount = 0;
            _lastSeenLogTimestamp = null;
            _lastSeenLogKey = null;
            return;
        }

        _lastSeenLogCount = replayIndex;
        var previousEntry = log[replayIndex - 1];
        var tsPrev = previousEntry?.Timestamp;
        _lastSeenLogTimestamp = string.IsNullOrWhiteSpace(tsPrev) ? null : tsPrev;
        _lastSeenLogKey = BuildLogKey(previousEntry);
    }

    internal IEnumerable<GameLogEntryDto> ExtractNewMessages(GameStateDto state)
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
            var entry = log[i];
            if (entry == null)
            {
                continue;
            }
            var msg = NormalizeGameLogMessage(entry.Message);
            if (!string.IsNullOrWhiteSpace(msg))
            {
                yield return new GameLogEntryDto(msg, entry.Timestamp);
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

    private static bool ShouldReplayLastPromptMessage(GameLogEntryDto? entry)
    {
        var msg = NormalizeGameLogMessage(entry?.Message);
        if (string.IsNullOrWhiteSpace(msg))
        {
            return false;
        }

        var lowered = msg.ToLowerInvariant();
        return lowered.Contains("doit choisir ");
    }

    private static int ResolveReplayPromptIndex(GameStateDto? state, IReadOnlyList<GameLogEntryDto> log)
    {
        if (log.Count <= 0)
        {
            return -1;
        }

        if (ShouldReplayLastPromptMessage(log[log.Count - 1]))
        {
            return log.Count - 1;
        }

        if (!ShouldReplayPendingChoicePrompt(state))
        {
            return -1;
        }

        var minIndex = Math.Max(0, log.Count - 12);
        for (var i = log.Count - 1; i >= minIndex; i--)
        {
            if (ShouldReplayLastPromptMessage(log[i]))
            {
                return i;
            }
        }

        return -1;
    }

    private static bool ShouldReplayPendingChoicePrompt(GameStateDto? state)
    {
        var pending = state?.Pending;
        if (pending == null)
        {
            return false;
        }

        var type = (pending.Type ?? string.Empty).Trim().ToLowerInvariant();
        if (type.Contains("choose", StringComparison.Ordinal))
        {
            return true;
        }

        var label = (pending.Label ?? pending.Question ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(label))
        {
            return false;
        }

        return label.Contains("choisir ", StringComparison.Ordinal);
    }
}
