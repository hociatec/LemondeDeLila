using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Core.Input;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Room.ViewModels;

/// <summary>
/// Vue modèle dédiée à la zone de jeu (room) et son historique associé.
/// </summary>
public sealed class GameRoomViewModel : ObservableObject
{
    private readonly Func<Task> _onQuit;
    private readonly IDialogService _dialogs;
    private string _status = "Table prête.";
    private object? _gameZoneContent;

    public GameRoomViewModel(CatalogGame game, Func<Task> onQuit, IDialogService dialogs)
    {
        Game = game ?? throw new ArgumentNullException(nameof(game));
        _onQuit = onQuit ?? throw new ArgumentNullException(nameof(onQuit));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));

        History = new GameHistoryViewModel(game);

        QuitCommand = new AsyncRelayCommand(QuitAsync);
        Shortcuts.Add(new ShortcutDefinition(
            'q',
            QuitCommand,
            description: "Quitter la table"));
    }

    public CatalogGame Game { get; }

    public GameHistoryViewModel History { get; }

    public ObservableCollection<ShortcutDefinition> Shortcuts { get; } = new();

    public ICommand QuitCommand { get; }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    public object? GameZoneContent
    {
        get => _gameZoneContent;
        set => SetProperty(ref _gameZoneContent, value);
    }

    private async Task QuitAsync()
    {
        var confirm = await _dialogs.Confirm(
            "Quitter la table",
            "Voulez-vous quitter la table et revenir à l'accueil ?").ConfigureAwait(true);

        if (confirm != true)
        {
            Status = "Retour annulé.";
            return;
        }

        Status = "Retour à l'accueil...";
        await _onQuit().ConfigureAwait(true);
    }
}
