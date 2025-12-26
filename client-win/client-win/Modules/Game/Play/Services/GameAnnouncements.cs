using System;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Play.Services;

public sealed class GameAnnouncements : IGameAnnouncements
{
    private readonly IScreenReaderAnnouncer _announcer;

    public GameAnnouncements(IScreenReaderAnnouncer announcer)
    {
        _announcer = announcer ?? throw new ArgumentNullException(nameof(announcer));
    }

    public void ShortcutKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return;

        // Le jeu ne doit pas annoncer la touche Entrée : on laisse l'écho clavier de NVDA (et/ou les retours serveur)
        // éviter les doublons "Entrée".
        var trimmed = key.Trim();
        if (trimmed.Equals("Enter", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("Entr", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        _announcer.AnnounceAssertive(key);
    }

    public void Info(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        _announcer.AnnouncePolite(message);
    }

    public void Error(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        _announcer.AnnounceAssertive(message);
    }
}
