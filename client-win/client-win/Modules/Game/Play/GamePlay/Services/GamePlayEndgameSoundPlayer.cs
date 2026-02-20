using System;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.Play.Session.Dtos;
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

        var outcome = GamePlayWinnerReader.TryExtractOutcomeForViewer(state, viewerPlayerId.Value);
        if (outcome == GamePlayWinnerReader.Outcome.Won)
        {
            _sounds.Play(SoundId.GameVictory);
            return;
        }
        if (outcome == GamePlayWinnerReader.Outcome.Lost)
        {
            _sounds.Play(SoundId.GameDefeat);
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

    internal void TryPlayEndgameSound(GameEndedDto? ended, int? fallbackViewerPlayerId = null)
    {
        if (ended == null)
        {
            return;
        }

        var viewerId = ended.ViewerPlayerId ?? fallbackViewerPlayerId;
        if (viewerId == null || viewerId.Value <= 0)
        {
            return;
        }

        var viewerOutcome = (ended.ViewerOutcome ?? string.Empty).Trim();
        if (string.Equals(viewerOutcome, "won", StringComparison.OrdinalIgnoreCase))
        {
            _sounds.Play(SoundId.GameVictory);
            return;
        }
        if (string.Equals(viewerOutcome, "lost", StringComparison.OrdinalIgnoreCase))
        {
            _sounds.Play(SoundId.GameDefeat);
            return;
        }

        if (ended.WinnerPlayerId == null || ended.WinnerPlayerId.Value <= 0)
        {
            return;
        }

        if (ended.WinnerPlayerId.Value == viewerId.Value)
        {
            _sounds.Play(SoundId.GameVictory);
            return;
        }

        _sounds.Play(SoundId.GameDefeat);
    }
}
