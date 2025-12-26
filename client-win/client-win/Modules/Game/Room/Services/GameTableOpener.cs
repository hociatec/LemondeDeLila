using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.Room.ViewModels;
using client_win.Modules.Game.Room.Views;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed class GameTableOpener : IGameTableOpener
{
    private readonly ILogger<GameTableOpener> _logger;
    private readonly IRoomGatewayClient _rooms;
    private readonly INavigationService _navigation;
    private readonly IDialogService _dialogs;
    private readonly IScreenReaderAnnouncer _announcer;

    public GameTableOpener(
        ILogger<GameTableOpener> logger,
        IRoomGatewayClient rooms,
        INavigationService navigation,
        IDialogService dialogs,
        IScreenReaderAnnouncer announcer)
    {
        _logger = logger;
        _rooms = rooms;
        _navigation = navigation;
        _dialogs = dialogs;
        _announcer = announcer;
    }

    public async Task OpenAsync(CatalogGame game, UserControl returnView)
    {
        if (game == null) throw new ArgumentNullException(nameof(game));
        if (returnView == null) throw new ArgumentNullException(nameof(returnView));

        RoomSession session;
        try
        {
            _logger.LogInformation("Création de la table: gameType={GameType}", game.Id);
            session = await _rooms.CreateAndConnectAsync(game.Id).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur création table: gameType={GameType}", game.Id);
            await _dialogs.ShowError("Création de table", $"Impossible de créer la table : {ex.Message}").ConfigureAwait(true);
            return;
        }

        var tableView = new GameRoomView();

        var bots = new RoomBotCommands(session);
        Task AddBot() => bots.AddBotAsync();
        Task RemoveBot() => bots.RemoveLastBotAsync();

        var tableVm = new GameRoomViewModel(
            game,
            onQuit: async () =>
        {
            try
            {
                bots.Dispose();
                await session.LeaveAsync().ConfigureAwait(true);
                await session.DisposeAsync().ConfigureAwait(true);
            }
            catch
            {
                // Best-effort; le backend ferme la table quand la dernière connexion sort.
            }

            _navigation.Show(returnView);
        },
            onAddBot: AddBot,
            onRemoveBot: RemoveBot,
            dialogs: _dialogs,
            announcer: _announcer);

        tableVm.Status = $"Table créée (id {session.RoomId}).";

        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        bots.BotAdded += name =>
        {
            dispatcher.InvokeAsync(() =>
            {
                tableVm.History.Entries.Add($"Serveur : bot ajouté ({name})");
                tableVm.Status = $"Bot ajouté : {name}.";
                _announcer.AnnouncePolite($"Bot ajouté : {name}");
            }, DispatcherPriority.Background);
        };
        bots.BotRemoved += name =>
        {
            dispatcher.InvokeAsync(() =>
            {
                tableVm.History.Entries.Add($"Serveur : bot retiré ({name})");
                tableVm.Status = $"Bot retiré : {name}.";
                _announcer.AnnouncePolite($"Bot retiré : {name}");
            }, DispatcherPriority.Background);
        };
        bots.ErrorReceived += message =>
        {
            dispatcher.InvokeAsync(() =>
            {
                tableVm.History.Entries.Add($"Serveur : erreur ({message})");
                tableVm.Status = $"Erreur : {message}";
                _announcer.AnnounceAssertive(message);
            }, DispatcherPriority.Background);
        };

        var serverRoom = session.LastRoomState?.Room;
        if (serverRoom != null)
        {
            tableVm.History.Entries.Add($"Serveur : table créée (id {serverRoom.Id})");
            if (!string.IsNullOrWhiteSpace(serverRoom.Status))
            {
                tableVm.History.Entries.Add($"Statut serveur : {serverRoom.Status}");
            }
            if (!string.IsNullOrWhiteSpace(serverRoom.GameType))
            {
                tableVm.History.Entries.Add($"GameType : {serverRoom.GameType}");
            }
            tableVm.History.Entries.Add($"Privée : {(serverRoom.IsPrivate ? "oui" : "non")}");
            if (serverRoom.MaxPlayers > 0)
            {
                tableVm.History.Entries.Add($"Max joueurs : {serverRoom.MaxPlayers}");
            }
        }

        tableView.DataContext = tableVm;
        _navigation.Show(tableView);
    }
}
