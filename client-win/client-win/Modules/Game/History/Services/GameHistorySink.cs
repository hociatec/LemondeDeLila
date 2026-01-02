using System;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;

namespace client_win.Modules.Game.History.Services;

public sealed class GameHistorySink : IGameHistorySink
{
    private readonly Dispatcher _dispatcher;
    private readonly GameHistoryViewModel _history;

    public GameHistorySink(Dispatcher dispatcher, GameHistoryViewModel history)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _history = history ?? throw new ArgumentNullException(nameof(history));
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
