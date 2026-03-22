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
    private int _lastTurnIndex;

    internal GamePlayDiceSoundPlayer(ISoundService sounds)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
    }

    internal void Reset()
    {
        _primed = false;
        _lastRoll = null;
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
        if (!_primed)
        {
            _primed = true;
            _lastRoll = roll;
            _lastTurnIndex = turnIndex;
            return;
        }

        if (roll == null || roll <= 0)
        {
            _lastRoll = roll;
            _lastTurnIndex = turnIndex;
            return;
        }

        var shouldPlay =
            roll != _lastRoll ||
            (turnIndex != _lastTurnIndex && roll > 0);

        _lastRoll = roll;
        _lastTurnIndex = turnIndex;
        if (shouldPlay)
        {
            _sounds.Play(SoundId.DiceRolled);
        }
    }
}
