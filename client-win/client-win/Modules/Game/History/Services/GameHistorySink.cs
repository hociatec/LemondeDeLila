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
            () =>
            {
                var cleaned = message.Trim();
                if (string.IsNullOrWhiteSpace(cleaned))
                {
                    return;
                }

                // Évite les doublons consécutifs (ex: "Table démarrée." deux fois).
                var count = _history.Entries.Count;
                if (count > 0)
                {
                    var last = _history.Entries[count - 1] ?? string.Empty;
                    if (string.Equals(last.Trim(), cleaned, StringComparison.Ordinal))
                    {
                        return;
                    }
                }

                // Évite les doublons de tour trop rapprochés (certains jeux le renvoient plusieurs fois).
                if (cleaned.StartsWith("C'est au tour de", StringComparison.OrdinalIgnoreCase) ||
                    cleaned.StartsWith("Tour actuel", StringComparison.OrdinalIgnoreCase))
                {
                    for (var i = Math.Max(0, count - 5); i < count; i++)
                    {
                        var prev = (_history.Entries[i] ?? string.Empty).Trim();
                        if (string.Equals(prev, cleaned, StringComparison.Ordinal))
                        {
                            return;
                        }
                    }
                }

                _history.Entries.Add(cleaned);
            },
            DispatcherPriority.Background);
    }
}
