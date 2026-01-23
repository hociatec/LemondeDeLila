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
    private bool _isReconnecting;

    public GameRoomViewModel(
        CatalogGame game,
        Func<string, Task> onSendChat,
        Func<Task> onShowRules,
        Func<Task> onConfigureTableAmbience,
        Func<Task> onConfigureTableAmbienceVolume,
        Func<Task> onStart,
        Func<Task> onSaveSnapshot,
        Func<Task> onReset,
        Func<Task> onQuit,
        Func<Task> onAddBot,
        Func<Task> onRemoveBot,
        Func<Task> onAnnouncePlayers,
        Func<Task> onAnnounceInfo,
        Func<Task> onTogglePrivacy,
        Func<Task> onToggleRole,
        Func<Task> onInvite,
        Func<Task> onKick,
        Func<Task> onBan,
        Func<Task> onTransferOwner,
        IDialogService dialogs,
        IScreenReaderAnnouncer screenReader,
        IAnnouncementService announcements)
    {
        Game = game ?? throw new ArgumentNullException(nameof(game));
        ScreenReader = screenReader ?? throw new ArgumentNullException(nameof(screenReader));
        Announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        History = new GameHistoryViewModel(game);

        var title = !string.IsNullOrWhiteSpace(game.Name) ? game.Name : game.Id;
        GameZone = new GameZoneHostViewModel(
            title,
            onShowRules,
            onConfigureTableAmbience,
            onConfigureTableAmbienceVolume,
            onStart,
            onSaveSnapshot,
            onReset,
            onQuit,
            onAddBot,
            onRemoveBot,
            onAnnouncePlayers,
            onAnnounceInfo,
            onTogglePrivacy,
            onToggleRole,
            onInvite,
            onKick,
            onBan,
            onTransferOwner,
            dialogs);
        GameZone.StatusRequested += s => Status = s;

        Chat = new GameRoomChatViewModel(game.ChatEnabled, onSendChat);
        Chat.IsSoundsEnabled = game.ChatSoundsEnabled;
    }

    public CatalogGame Game { get; }

    public IScreenReaderAnnouncer ScreenReader { get; }

    public IAnnouncementService Announcements { get; }

    public GameHistoryViewModel History { get; }

    public GameZoneHostViewModel GameZone { get; }

    public GameRoomChatViewModel Chat { get; }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    public bool IsReconnecting
    {
        get => _isReconnecting;
        set => SetProperty(ref _isReconnecting, value);
    }
}
