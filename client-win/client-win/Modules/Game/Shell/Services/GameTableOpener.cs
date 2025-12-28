using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.Play.Services;
using client_win.Modules.Game.Play.ViewModels;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.Services;

public sealed class GameTableOpener : IGameTableOpener
{
    private readonly ILogger<GameTableOpener> _logger;
    private readonly IRoomGatewayClient _rooms;
    private readonly IGameGatewayClient _games;
    private readonly INavigationService _navigation;
    private readonly IDialogService _dialogs;
    private readonly IRoomAnnouncements _announcements;
    private readonly IGameAnnouncements _gameAnnouncements;

    public GameTableOpener(
        ILogger<GameTableOpener> logger,
        IRoomGatewayClient rooms,
        IGameGatewayClient games,
        INavigationService navigation,
        IDialogService dialogs,
        IRoomAnnouncements announcements,
        IGameAnnouncements gameAnnouncements)
    {
        _logger = logger;
        _rooms = rooms;
        _games = games;
        _navigation = navigation;
        _dialogs = dialogs;
        _announcements = announcements;
        _gameAnnouncements = gameAnnouncements;
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
            await _dialogs.ShowError("Création de table", $"Impossible de créer la table : {ex.Message}")
                .ConfigureAwait(true);
            return;
        }

        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        var tableView = new GameRoomView();

        GameTableBindings? bindings = null;

        Task Start() => session.SendCommandAsync("room.start", payload: null);
        Task Reset() => session.SendCommandAsync("room.reset", payload: null);
        Task AddBot() => bindings?.AddBotAsync() ?? Task.CompletedTask;
        Task RemoveBot() => bindings?.RemoveBotAsync() ?? Task.CompletedTask;
        Task AnnouncePlayers() => AnnouncePlayersAsync(session);
        Task AnnounceInfo()
        {
            _announcements.ShortcutKey("i");
            return bindings?.RequestInfoAsync() ?? Task.CompletedTask;
        }
        Task TogglePrivacy() => bindings?.TogglePrivacyAsync() ?? Task.CompletedTask;
        Task ToggleRole() => bindings?.ToggleRoleAsync() ?? Task.CompletedTask;

        var tableVm = new GameRoomViewModel(
            game,
            onStart: Start,
            onReset: Reset,
            onQuit: async () =>
            {
                try
                {
                    if (bindings != null)
                    {
                        await bindings.DisposeAsync().ConfigureAwait(true);
                        bindings = null;
                    }
                }
                catch
                {
                    // Best-effort; le backend ferme la table quand la dernière connexion sort.
                }

                _navigation.Show(returnView);
            },
            onAddBot: AddBot,
            onRemoveBot: RemoveBot,
            onAnnouncePlayers: AnnouncePlayers,
            onAnnounceInfo: AnnounceInfo,
            onTogglePrivacy: TogglePrivacy,
            onToggleRole: ToggleRole,
            dialogs: _dialogs);

        tableVm.Status = "Table créée.";
        var createdMessage = $"Table de {game.Name} créée. Ajoutez des bots et commencez à jouer.";
        tableVm.History.Entries.Add(createdMessage);
        _gameAnnouncements.Info(createdMessage);

        bindings = new GameTableBindings(
            dispatcher: dispatcher,
            game: game,
            session: session,
            tableView: tableView,
            tableVm: tableVm,
            announcements: _announcements,
            createGamePlayVm: () => CreateGamePlayViewModel(session, game));
        bindings.Attach();
        bindings.InitializeFromLastState();

        // Les détails techniques (status/gameType/privacy/max) ne vont pas dans l'historique : trop verbeux.

        tableView.DataContext = tableVm;
        _navigation.Show(tableView);
    }

    private GamePlayViewModel CreateGamePlayViewModel(RoomSession room, CatalogGame game)
    {
        return new GamePlayViewModel(
            connect: ct => _games.ConnectAsync(room.RoomId, game.Id, ct),
            dialogs: _dialogs,
            announcements: _gameAnnouncements);
    }

    private Task AnnouncePlayersAsync(RoomSession session)
    {
        _announcements.ShortcutKey("w");

        var room = session.LastRoomState?.Room;
        if (room == null)
        {
            _announcements.PlayersList("Table : informations indisponibles.");
            return Task.CompletedTask;
        }

        var players = (room.Players ?? new List<RoomUserDto>())
            .Select(p => p?.Username)
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Cast<string>()
            .ToList();

        var spectators = (room.Spectators ?? new List<RoomUserDto>())
            .Select(p => p?.Username)
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Cast<string>()
            .ToList();

        var bots = (room.Bots ?? new List<RoomBotDto>())
            .Select(b => b?.Name)
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Cast<string>()
            .ToList();

        static string FormatList(string label, IReadOnlyCollection<string> items) =>
            $"{label} : {(items.Count > 0 ? string.Join(", ", items) : "aucun")}";

        _announcements.PlayersList(
            $"{FormatList("Joueurs", players)}. {FormatList("Spectateurs", spectators)}. {FormatList("Bots", bots)}.");
        return Task.CompletedTask;
    }
}
