using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Linq;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Catalog.Models;

namespace client_win.Modules.Game.History.ViewModels;

public sealed class GameHistoryViewModel : ObservableObject
{
    private const int MaxEntries = 400;
    private string _displayText = string.Empty;
    private bool _isPruning;
    private bool _pruneScheduled;
    private readonly Dispatcher _dispatcher;

    public GameHistoryViewModel(CatalogGame game)
    {
        if (game == null) throw new ArgumentNullException(nameof(game));

        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        Entries.CollectionChanged += OnEntriesChanged;
        RebuildDisplayText();
    }

    public ObservableCollection<string> Entries { get; } = new();

    public string DisplayText
    {
        get => _displayText;
        private set => SetProperty(ref _displayText, value);
    }

    private void OnEntriesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        // IMPORTANT: on ne peut pas modifier une ObservableCollection pendant son événement CollectionChanged
        // (sinon InvalidOperationException: "Cannot change ObservableCollection during a CollectionChanged event.").
        // On planifie donc l'élagage après coup sur le Dispatcher UI.
        if (!_isPruning && Entries.Count > MaxEntries)
        {
            SchedulePrune();
        }

        RebuildDisplayText();
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

    private void RebuildDisplayText()
    {
        DisplayText = string.Join(Environment.NewLine, Entries.Where(s => !string.IsNullOrEmpty(s)));
    }
}
