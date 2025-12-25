using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Linq;
using client_win.Modules.Catalog.Models;
using client_win.Core;

namespace client_win.Modules.Game.History.ViewModels;

public sealed class GameHistoryViewModel : ObservableObject
{
    private string _displayText = string.Empty;

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

    private void OnEntriesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        RebuildDisplayText();
    }

    private void RebuildDisplayText()
    {
        DisplayText = string.Join(Environment.NewLine, Entries.Where(s => !string.IsNullOrEmpty(s)));
    }
}
