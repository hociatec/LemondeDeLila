using System;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.ViewModels;

/// <summary>
/// Vue modèle racine de la room : compose les sous-modules (zone de jeu, historique, statut).
/// </summary>
public sealed class GameRoomViewModel : ObservableObject
{
    private string _status = "Table prête.";

    public GameRoomViewModel(
        CatalogGame game,
        Func<string, Task> onSendChat,
        Func<Task> onStart,
        Func<Task> onReset,
        Func<Task> onQuit,
        Func<Task> onAddBot,
        Func<Task> onRemoveBot,
        Func<Task> onAnnouncePlayers,
        Func<Task> onAnnounceInfo,
        Func<Task> onTogglePrivacy,
        Func<Task> onToggleRole,
        IDialogService dialogs)
    {
        Game = game ?? throw new ArgumentNullException(nameof(game));
        History = new GameHistoryViewModel(game);

        var title = !string.IsNullOrWhiteSpace(game.Name) ? game.Name : game.Id;
        GameZone = new GameZoneHostViewModel(title, onStart, onReset, onQuit, onAddBot, onRemoveBot, onAnnouncePlayers, onAnnounceInfo, onTogglePrivacy, onToggleRole, dialogs);
        GameZone.StatusRequested += s => Status = s;

        Chat = new GameRoomChatViewModel(game.ChatEnabled, onSendChat);
    }

    public CatalogGame Game { get; }

    public GameHistoryViewModel History { get; }

    public GameZoneHostViewModel GameZone { get; }

    public GameRoomChatViewModel Chat { get; }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }
}
