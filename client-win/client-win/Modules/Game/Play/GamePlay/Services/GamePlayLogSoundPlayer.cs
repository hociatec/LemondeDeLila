using System;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.Common;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal sealed class GamePlayLogSoundPlayer
{
    private readonly ISoundService _sounds;
    private DateTime _lastDrawSoundUtc = DateTime.MinValue;
    private static readonly TimeSpan DrawSoundCooldown = GameTiming.Audio.DrawSoundCooldown;

    internal GamePlayLogSoundPlayer(ISoundService sounds)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
    }

    internal void TryPlayForLogMessage(string message, string? viewerUsername)
    {
        var msg = (message ?? string.Empty).Trim();
        if (msg.Length == 0)
        {
            return;
        }

        // Quiz: keep the explicit feedback sound, but only for the local player's answer.
        if (!string.IsNullOrWhiteSpace(viewerUsername))
        {
            var prefix = viewerUsername.Trim() + " répond :";
            if (msg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                if (msg.Contains("Bonne réponse", StringComparison.OrdinalIgnoreCase))
                {
                    _sounds.Play(SoundId.QuizCorrect);
                    return;
                }
                if (msg.Contains("Mauvaise réponse", StringComparison.OrdinalIgnoreCase))
                {
                    _sounds.Play(SoundId.QuizWrong);
                    return;
                }
            }
        }

        if (msg.StartsWith("Fin de la manche", StringComparison.OrdinalIgnoreCase))
        {
            _sounds.Play(SoundId.RoundEnded);
        }
    }

    internal void TryPlayDrawSound()
    {
        var now = DateTime.UtcNow;
        if (now - _lastDrawSoundUtc < DrawSoundCooldown)
        {
            return;
        }

        _lastDrawSoundUtc = now;
        _sounds.Play(SoundId.DrawCard);
    }

    // Draw sound is triggered by the draw action itself (client action send / server key ack),
    // not by parsing log text.
}
