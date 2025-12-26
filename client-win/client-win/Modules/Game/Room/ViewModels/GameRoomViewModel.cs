using System;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Room.ViewModels;

/// <summary>
/// Vue modèle racine de la room : compose les sous-modules (zone de jeu, historique, statut).
/// </summary>
public sealed class GameRoomViewModel : ObservableObject
{
    private string _status = "Table prête.";

    public GameRoomViewModel(
        CatalogGame game,
        Func<Task> onQuit,
        Func<Task> onAddBot,
        Func<Task> onRemoveBot,
        Func<Task> onAnnouncePlayers,
        Func<Task> onTogglePrivacy,
        Func<Task> onToggleRole,
        IDialogService dialogs)
    {
        Game = game ?? throw new ArgumentNullException(nameof(game));
        History = new GameHistoryViewModel(game);

        GameZone = new GameZoneHostViewModel(onQuit, onAddBot, onRemoveBot, onAnnouncePlayers, onTogglePrivacy, onToggleRole, dialogs);
        GameZone.StatusRequested += s => Status = s;
    }

    public CatalogGame Game { get; }

    public GameHistoryViewModel History { get; }

    public GameZoneHostViewModel GameZone { get; }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }
}
