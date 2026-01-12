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

    internal GamePlayDiceSoundPlayer(ISoundService sounds)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
    }

    internal void Reset()
    {
        _primed = false;
        _lastRoll = null;
    }

    internal void TryPlayDiceRollSound(GameStateDto? state)
    {
        if (state == null)
        {
            return;
        }

        var roll = state.LastRoll;
        if (!_primed)
        {
            _primed = true;
            _lastRoll = roll;
            return;
        }

        if (roll == null || roll <= 0 || roll == _lastRoll)
        {
            _lastRoll = roll;
            return;
        }

        _lastRoll = roll;
        _sounds.Play(SoundId.DiceRolled);
    }
}

