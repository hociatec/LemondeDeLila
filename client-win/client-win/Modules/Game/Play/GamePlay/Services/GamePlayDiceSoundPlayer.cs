using System;
using System.Collections.Generic;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal sealed class GamePlayDiceSoundPlayer
{
    private readonly ISoundService _sounds;
    private bool _primed;
    private int? _lastRoll;
    private int _lastLogCount;
    private int _lastTurnIndex;
    private string _lastLogSignature = string.Empty;

    internal GamePlayDiceSoundPlayer(ISoundService sounds)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
    }

    internal void Reset()
    {
        _primed = false;
        _lastRoll = null;
        _lastLogCount = 0;
        _lastTurnIndex = 0;
    }

    internal void TryPlayDiceRollSound(GameStateDto? state)
    {
        if (state == null)
        {
            return;
        }

        var roll = state.LastRoll;
        var turnIndex = state.TurnIndex;
        var log = state.Log;
        var logCount = log?.Count ?? 0;
        if (!_primed)
        {
            _primed = true;
            _lastRoll = roll;
            _lastTurnIndex = turnIndex;
            _lastLogCount = logCount;
            UpdateLogSignature(log);
            return;
        }

        if (TryPlayDiceSoundFromLog(log))
        {
            _lastLogCount = logCount;
            _lastRoll = roll;
            _lastTurnIndex = turnIndex;
            return;
        }

        // Fallback: if the engine updates LastRoll without a log line, play when roll changes,
        // or when turn index changes with a valid roll (even if the same value).
        if (roll == null || roll <= 0)
        {
            _lastRoll = roll;
            _lastTurnIndex = turnIndex;
            _lastLogCount = logCount;
            UpdateLogSignature(log);
            return;
        }

        var shouldPlay =
            roll != _lastRoll ||
            (turnIndex != _lastTurnIndex && roll > 0);

        _lastRoll = roll;
        _lastTurnIndex = turnIndex;
        _lastLogCount = logCount;
        UpdateLogSignature(log);
        if (shouldPlay)
        {
            _sounds.Play(SoundId.DiceRolled);
        }
    }

    private bool TryPlayDiceSoundFromLog(IList<GameLogEntryDto>? log)
    {
        if (log == null || log.Count == 0)
        {
            UpdateLogSignature(log);
            return false;
        }

        var matchedLastSignature = string.IsNullOrEmpty(_lastLogSignature);
        var triggered = false;
        foreach (var entry in log)
        {
            var signature = BuildLogSignature(entry);
            if (string.IsNullOrEmpty(signature))
            {
                continue;
            }

            if (!matchedLastSignature)
            {
                if (string.Equals(signature, _lastLogSignature, StringComparison.Ordinal))
                {
                    matchedLastSignature = true;
                }
                continue;
            }

            if (!triggered && IsDiceLogMessage(entry.Message))
            {
                triggered = true;
            }
        }

        if (!matchedLastSignature && !string.IsNullOrEmpty(_lastLogSignature))
        {
            foreach (var entry in log)
            {
                if (IsDiceLogMessage(entry?.Message ?? string.Empty))
                {
                    triggered = true;
                    break;
                }
            }
        }

        UpdateLogSignature(log);
        return triggered;
    }

    private void UpdateLogSignature(IList<GameLogEntryDto>? log)
    {
        if (log == null || log.Count == 0)
        {
            _lastLogSignature = string.Empty;
            return;
        }
        var lastEntry = log[log.Count - 1];
        var signature = BuildLogSignature(lastEntry);
        _lastLogSignature = string.IsNullOrEmpty(signature) ? string.Empty : signature;
    }

    private static string BuildLogSignature(GameLogEntryDto entry)
    {
        if (entry == null)
        {
            return string.Empty;
        }
        var timestamp = entry.Timestamp?.Trim() ?? string.Empty;
        var message = entry.Message?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(timestamp) && string.IsNullOrEmpty(message))
        {
            return string.Empty;
        }
        return $"{timestamp}|{message}";
    }

    private static bool IsDiceLogMessage(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        var trimmed = message.Trim();
        return trimmed.IndexOf("lance le dé", StringComparison.OrdinalIgnoreCase) >= 0 ||
               trimmed.IndexOf("relance le dé", StringComparison.OrdinalIgnoreCase) >= 0;
    }
}

