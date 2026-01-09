using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal sealed class GamePlayEndgameSoundPlayer
{
    private readonly ISoundService _sounds;

    internal GamePlayEndgameSoundPlayer(ISoundService sounds)
    {
        _sounds = sounds;
    }

    internal void TryPlayEndgameSound(GameStateDto? state, int? viewerPlayerId)
    {
        if (state == null || viewerPlayerId == null || viewerPlayerId.Value <= 0)
        {
            return;
        }

        var winnerId = GamePlayWinnerReader.TryExtractWinnerPlayerId(state);
        if (winnerId == null)
        {
            return;
        }

        if (winnerId.Value == viewerPlayerId.Value)
        {
            _sounds.Play(SoundId.GameVictory);
            return;
        }

        _sounds.Play(SoundId.GameDefeat);
    }
}

