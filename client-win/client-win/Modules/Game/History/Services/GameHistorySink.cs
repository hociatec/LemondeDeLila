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

        _dispatcher.InvokeAsync(
            () =>
            {
                foreach (var part in parts)
                {
                    var cleaned = (part ?? string.Empty).Trim();
                    if (string.IsNullOrWhiteSpace(cleaned))
                    {
                        continue;
                    }

                    var isTurnLine =
                        cleaned.StartsWith("C'est au tour de", StringComparison.OrdinalIgnoreCase) ||
                        cleaned.StartsWith("Tour actuel", StringComparison.OrdinalIgnoreCase);

                    // Évite les doublons consécutifs (ex: "Table démarrée." deux fois).
                    var count = _history.Entries.Count;
                    if (!isTurnLine && count > 0)
                    {
                        var last = _history.Entries[count - 1] ?? string.Empty;
                        if (string.Equals(last.Trim(), cleaned, StringComparison.Ordinal))
                        {
                            continue;
                        }
                    }

                    _history.Entries.Add(cleaned);
                }
            },
            DispatcherPriority.Background);
    }
}
