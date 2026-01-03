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
        // Annonces directes désactivées: l'historique est la source unique d'annonces.
    }

    public void Info(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        // IMPORTANT:
        // Les messages "Info" sont déjà ajoutés à l'historique et annoncés depuis l'historique
        // (séquencé) pour éviter que le lecteur d'écran ne coupe des annonces en rafale.
    }

    public void Error(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        // IMPORTANT:
        // Les erreurs sont déjà relayées vers l'historique (MessageReceived) et annoncées depuis l'historique.
        // On évite une annonce directe ici pour ne pas doubler.
    }
}
