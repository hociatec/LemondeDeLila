using System;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;

namespace client_win.Modules.Game.Play.GamePlay.Services;

internal sealed class GamePlayLogSoundPlayer
{
    private readonly ISoundService _sounds;
    private DateTime _lastDrawSoundUtc = DateTime.MinValue;
    private static readonly TimeSpan DrawSoundCooldown = TimeSpan.FromMilliseconds(350);

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

        // Quiz (Arche de Mnémosyne): le serveur écrit explicitement "Bonne réponse"/"Mauvaise réponse".
        // Jouer le son uniquement pour la réponse du joueur local (évite le spam sonore).
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

        // Fin de manche (LAMA et autres jeux qui utilisent ce libellé).
        if (msg.StartsWith("Fin de la manche", StringComparison.OrdinalIgnoreCase))
        {
            _sounds.Play(SoundId.RoundEnded);
        }

        // Fallback robuste: certains jeux/états n'exposent pas toujours LastDraw de façon stable.
        // Quand une nouvelle ligne d'historique indique une pioche, jouer aussi le son.
        if (msg.Contains(" pioche", StringComparison.OrdinalIgnoreCase) &&
            !msg.Contains("doit piocher", StringComparison.OrdinalIgnoreCase))
        {
            TryPlayDrawSound();
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
}
