using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;

namespace client_win.Modules.Game.History.ViewModels;

public sealed class GameHistoryViewModel : ObservableObject
{
    private const int MaxEntries = int.MaxValue;
    private bool _isPruning;
    private bool _pruneScheduled;
    private readonly Dispatcher _dispatcher;

    public GameHistoryViewModel(CatalogGame game)
    {
        if (game == null) throw new ArgumentNullException(nameof(game));

        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        Entries.CollectionChanged += OnEntriesChanged;
    }

    public ObservableCollection<string> Entries { get; } = new();

    private void OnEntriesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        // IMPORTANT: on ne peut pas modifier une ObservableCollection pendant son événement CollectionChanged
        // (sinon InvalidOperationException: "Cannot change ObservableCollection during a CollectionChanged event.").
        // On planifie donc l'élagage après coup sur le Dispatcher UI.
        if (!_isPruning && Entries.Count > MaxEntries)
        {
            SchedulePrune();
        }
    }

    private void SchedulePrune()
    {
        if (_pruneScheduled)
        {
            return;
        }

        _pruneScheduled = true;
        _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            _pruneScheduled = false;

            if (_isPruning)
            {
                return;
            }

            try
            {
                _isPruning = true;
                while (Entries.Count > MaxEntries)
                {
                    Entries.RemoveAt(0);
                }
            }
            finally
            {
                _isPruning = false;
            }
        }));
    }

    public IGameHistoryAnnouncer? Announcer { get; set; }
}
