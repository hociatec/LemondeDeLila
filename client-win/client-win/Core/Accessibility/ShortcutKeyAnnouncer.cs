using System;
using client_win.Modules.Shell.Services;

namespace client_win.Core.Accessibility;

public static class ShortcutKeyAnnouncer
{
    private static int _initialized;
    private static IScreenReaderAnnouncer? _announcer;

    public static void Initialize(IScreenReaderAnnouncer announcer)
    {
        if (announcer == null) throw new ArgumentNullException(nameof(announcer));
        if (System.Threading.Interlocked.Exchange(ref _initialized, 1) == 1)
        {
            return;
        }

        _announcer = announcer;
    }

    public static void Announce(char key)
    {
        if (key == '\0')
        {
            return;
        }

        // NVDA n'annonce pas toujours la touche si on la consomme (e.Handled = true).
        // Ici on restitue le retour immédiat, sans attendre une réponse serveur.
        _announcer?.AnnounceAssertive(key.ToString());
    }
}

