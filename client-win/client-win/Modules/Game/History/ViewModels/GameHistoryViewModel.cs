using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Linq;
using client_win.Core;
using client_win.Modules.Catalog.Models;

namespace client_win.Modules.Game.History.ViewModels;

public sealed class GameHistoryViewModel : ObservableObject
{
    private const int MaxEntries = 400;
    private string _displayText = string.Empty;
    private string _lastAnnouncement = string.Empty;
    private bool _isPruning;

    public GameHistoryViewModel(CatalogGame game)
    {
        if (game == null) throw new ArgumentNullException(nameof(game));

        Entries.CollectionChanged += OnEntriesChanged;
        Entries.Add($"Ouverture de la table pour {game.Name}");
        Entries.Add($"Moteur : {game.Engine}");
        Entries.Add($"Joueurs : {game.MinPlayers}-{game.MaxPlayers}");
        RebuildDisplayText();
    }

    public ObservableCollection<string> Entries { get; } = new();

    public string DisplayText
    {
        get => _displayText;
        private set => SetProperty(ref _displayText, value);
    }

    public string LastAnnouncement
    {
        get => _lastAnnouncement;
        private set => SetProperty(ref _lastAnnouncement, value);
    }

    private void OnEntriesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (!_isPruning && Entries.Count > MaxEntries)
        {
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
        }

        RebuildDisplayText();
        UpdateLastAnnouncement(e);
    }

    private void RebuildDisplayText()
    {
        DisplayText = string.Join(Environment.NewLine, Entries.Where(s => !string.IsNullOrEmpty(s)));
    }

    private void UpdateLastAnnouncement(NotifyCollectionChangedEventArgs e)
    {
        string? next = null;

        if (e.Action == NotifyCollectionChangedAction.Add && e.NewItems != null && e.NewItems.Count > 0)
        {
            next = e.NewItems[e.NewItems.Count - 1] as string;
        }
        else if (e.Action == NotifyCollectionChangedAction.Reset && Entries.Count > 0)
        {
            next = Entries[Entries.Count - 1];
        }

        if (string.IsNullOrWhiteSpace(next))
        {
            return;
        }

        // Force a UIA live-region update even if the message repeats.
        if (string.Equals(LastAnnouncement, next, StringComparison.Ordinal))
        {
            LastAnnouncement = next + " ";
            return;
        }

        if (string.Equals(LastAnnouncement, next + " ", StringComparison.Ordinal))
        {
            LastAnnouncement = next;
            return;
        }

        LastAnnouncement = next;
    }
}
