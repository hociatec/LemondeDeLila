using System;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal sealed class GamePlayDiceSoundPlayer
{
    private readonly ISoundService _sounds;
    private bool _primed;
    private string? _lastRollKey;

    internal GamePlayDiceSoundPlayer(ISoundService sounds)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
    }

    internal void Reset()
    {
        _primed = false;
        _lastRollKey = null;
    }

    internal void TryPlayDiceRollSound(
        GameStateDto? state,
        bool suppressForCurrentUpdate = false,
        bool forceForCurrentUpdate = false)
    {
        if (state == null)
        {
            return;
        }

        var (roll, rollKey) = ReadDice(state);
        if (!_primed)
        {
            _primed = true;
            _lastRollKey = rollKey;
            return;
        }

        if (roll == null || roll <= 0 || string.IsNullOrWhiteSpace(rollKey))
        {
            _lastRollKey = rollKey;
            return;
        }

        var shouldPlay = !string.Equals(rollKey, _lastRollKey, StringComparison.Ordinal);

        _lastRollKey = rollKey;
        if ((shouldPlay || forceForCurrentUpdate) && !suppressForCurrentUpdate)
        {
            _sounds.Play(SoundId.DiceRolled);
        }
    }

    private static (int? Total, string? RollKey) ReadDice(GameStateDto state)
    {
        var extras = state.Extras;
        if (extras.ValueKind != System.Text.Json.JsonValueKind.Object ||
            !extras.TryGetProperty("dice", out var dice) ||
            dice.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            return (null, null);
        }

        int? total = dice.TryGetProperty("total", out var totalElement) &&
                     totalElement.ValueKind == System.Text.Json.JsonValueKind.Number &&
                     totalElement.TryGetInt32(out var value)
            ? value
            : null;
        var key = dice.TryGetProperty("rollKey", out var keyElement) &&
                  keyElement.ValueKind == System.Text.Json.JsonValueKind.String
            ? keyElement.GetString()
            : null;
        return (total, key);
    }
}
