using System;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Services;

public sealed class GameHistorySink : IGameHistorySink
{
    private readonly Dispatcher _dispatcher;
    private readonly GameHistoryViewModel _history;
    private readonly IAnnouncementService? _announcements;

    public GameHistorySink(Dispatcher dispatcher, GameHistoryViewModel history, IAnnouncementService? announcements = null)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _history = history ?? throw new ArgumentNullException(nameof(history));
        _announcements = announcements;
    }

    public void Add(string message)
    {
        var parts = GameHistoryMessageSplitter.Split(message);
        if (parts.Count == 0)
        {
            return;
        }

        void AddNow()
        {
            foreach (var part in parts)
            {
                var cleaned = (part ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(cleaned))
                {
                    continue;
                }

                _history.Entries.Add(cleaned);

                // Robustesse lecteur d'écran: annoncer explicitement chaque ligne.
                // On séquence avec un petit espacement pour éviter que NVDA "avale" des lignes lors d'une rafale.
                _announcements?.Enqueue(cleaned, AnnouncementPriority.Polite);
            }
        }

        // IMPORTANT:
        // Si on est déjà sur le thread UI (cas normal: update de game.state),
        // ajouter immédiatement pour préserver l'ordre des annonces (historique avant interface).
        if (_dispatcher.CheckAccess())
        {
            AddNow();
        }
        else
        {
            _dispatcher.InvokeAsync(AddNow, DispatcherPriority.Background);
        }
    }
}
