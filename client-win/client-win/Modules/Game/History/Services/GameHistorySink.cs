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
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        _dispatcher.InvokeAsync(
            () => _history.Entries.Add(message),
            DispatcherPriority.Background);
    }
}

