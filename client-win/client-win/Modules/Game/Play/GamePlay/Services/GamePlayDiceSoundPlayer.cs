using System;
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
            return;
        }

        // Prefer log-based detection so consecutive identical rolls still trigger a sound.
        // Most dice-based games log: "X lance le dé : "N"." or "X relance le dé : "N"."
        if (logCount > _lastLogCount && log != null)
        {
            for (var i = _lastLogCount; i < logCount; i++)
            {
                var msg = (log[i]?.Message ?? string.Empty).Trim();
                if (msg.Length == 0) continue;
                if (msg.IndexOf("lance le dé", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    msg.IndexOf("relance le dé", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    _sounds.Play(SoundId.DiceRolled);
                    break;
                }
            }
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
            return;
        }

        var shouldPlay =
            roll != _lastRoll ||
            (turnIndex != _lastTurnIndex && roll > 0);

        _lastRoll = roll;
        _lastTurnIndex = turnIndex;
        _lastLogCount = logCount;
        if (shouldPlay)
        {
            _sounds.Play(SoundId.DiceRolled);
        }
    }
}

