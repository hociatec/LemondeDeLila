using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.Play.GamePlay.ViewModels;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Catalog.Views;
using client_win.Modules.Presence.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.MainMenu.Views;

namespace client_win.Modules.Game.Shell.Services;

public sealed class GameTableOpener : IGameTableOpener
{
    private readonly ILogger<GameTableOpener> _logger;
    private readonly IRoomGatewayClient _rooms;
    private readonly IGameGatewayClient _games;
    private readonly INavigationService _navigation;
    private readonly IDialogService _dialogs;
    private readonly IScreenReaderAnnouncer _screenReader;
    private readonly IAnnouncementService _announcementService;
    private readonly IRoomAnnouncements _announcements;
    private readonly IPresenceMonitor _presence;
    private readonly ISoundService _sounds;

    public GameTableOpener(
        ILogger<GameTableOpener> logger,
        IRoomGatewayClient rooms,
        IGameGatewayClient games,
        INavigationService navigation,
        IDialogService dialogs,
        IScreenReaderAnnouncer screenReader,
        IAnnouncementService announcementService,
        IRoomAnnouncements announcements,
        IPresenceMonitor presence,
        ISoundService sounds)
    {
        _logger = logger;
        _rooms = rooms;
        _games = games;
        _navigation = navigation;
        _dialogs = dialogs;
        _screenReader = screenReader ?? throw new ArgumentNullException(nameof(screenReader));
        _announcementService = announcementService ?? throw new ArgumentNullException(nameof(announcementService));
        _announcements = announcements;
        _presence = presence ?? throw new ArgumentNullException(nameof(presence));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
    }

    public async Task OpenAsync(CatalogGame game, UserControl returnView)
    {
        if (game == null) throw new ArgumentNullException(nameof(game));
        if (returnView == null) throw new ArgumentNullException(nameof(returnView));

        await OpenDeferredAsync(
                placeholderGame: game,
                returnView: returnView,
                connect: ct => _rooms.CreateAndConnectAsync(game.Id, ct),
                buildGameFromSession: _ => game,
                isNew: true)
            .ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, UserControl returnView)
    {
        await OpenExistingAsync(roomId, returnView, spectator: false).ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, UserControl returnView, bool spectator)
    {
        await OpenExistingAsync(roomId, returnView, spectator, silent: false).ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, UserControl returnView, bool spectator, bool silent)
    {
        if (roomId <= 0) throw new ArgumentException("roomId invalide", nameof(roomId));
        if (returnView == null) throw new ArgumentNullException(nameof(returnView));

        var placeholderGame = new CatalogGame(
            code: "unknown",
            name: $"Table #{roomId}",
            summary: "Connexion…",
            minPlayers: 1,
            maxPlayers: 8,
            engine: string.Empty,
            categories: Array.Empty<string>());

        await OpenDeferredAsync(
                placeholderGame: placeholderGame,
                returnView: returnView,
                connect: ct => _rooms.ConnectAsync(roomId, spectator, silent, ct),
                buildGameFromSession: session =>
                {
                    var payload = session.LastRoomState;
                    var manifest = payload?.Manifest;
                    var gameType = payload?.Room?.GameType;
                    var name = manifest?.Name;
                    var min = manifest?.MinPlayers ?? 1;
                    var max = manifest?.MaxPlayers ?? 8;

                    return new CatalogGame(
                        code: string.IsNullOrWhiteSpace(gameType) ? "unknown" : gameType!,
                        name: string.IsNullOrWhiteSpace(name) ? $"Table #{roomId}" : name!,
                        summary: string.Empty,
                        minPlayers: min,
                        maxPlayers: max,
                        engine: string.Empty,
                        categories: Array.Empty<string>());
                },
                isNew: false)
            .ConfigureAwait(true);
    }

    private async Task OpenDeferredAsync(
        CatalogGame placeholderGame,
        UserControl returnView,
        Func<CancellationToken, Task<RoomSession>> connect,
        Func<RoomSession, CatalogGame> buildGameFromSession,
        bool isNew)
    {
        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        var cts = new CancellationTokenSource();
        RoomSession? session = null;
        GameTableBindings? bindings = null;
        Action<client_win.Modules.Network.WebSockets.WebSocketState>? onRoomConnectionStateChanged = null;
        var isExiting = 0;

        async Task ExitAsync(string? reason = null)
        {
            if (Interlocked.Exchange(ref isExiting, 1) == 1)
            {
                return;
            }

            try
            {
                try { cts.Cancel(); } catch { }

                if (session != null && onRoomConnectionStateChanged != null)
                {
                    session.ConnectionStateChanged -= onRoomConnectionStateChanged;
                    onRoomConnectionStateChanged = null;
                }

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
                    // best-effort
                }

                if (session != null)
                {
                    try { await session.DisposeAsync().ConfigureAwait(false); } catch { }
                    session = null;
                }

                _ = _presence.SetHomeAsync();

                if (!dispatcher.CheckAccess())
                {
                    await dispatcher.InvokeAsync(() => _navigation.Show(returnView), DispatcherPriority.Normal);
                }
                else
                {
                    _navigation.Show(returnView);
                }

                // Réactive l'ambiance/musique si on revient vers un écran qui en a une.
                try
                {
                    _sounds.StopLoop(SoundId.MainMenuMusic);
                    _sounds.StopLoop(SoundId.TavernAmbience);
                    if (returnView is CatalogView)
                    {
                        _sounds.StartLoop(SoundId.TavernAmbience);
                    }
                    else if (returnView is MainMenuView)
                    {
                        _sounds.StartLoop(SoundId.MainMenuMusic);
                    }
                }
                catch
                {
                    // ignore
                }

                if (!string.IsNullOrWhiteSpace(reason))
                {
                    try { await _dialogs.ShowInfo("Table", reason.Trim()).ConfigureAwait(true); } catch { }
                }
            }
            finally
            {
                Interlocked.Exchange(ref isExiting, 0);
            }
        }

        GameRoomView? tableView = null;
        GameRoomViewModel? vm = null;

        await dispatcher.InvokeAsync(() =>
        {
                        tableView = new GameRoomView();
                        tableView.SetScreenReader(_screenReader);
                        tableView.SetAnnouncementService(_announcementService);

            Task Start() => session?.SendCommandAsync("room.start", payload: null) ?? Task.CompletedTask;
            Task Reset() => session?.SendCommandAsync("room.reset", payload: null) ?? Task.CompletedTask;
            Task SendChat(string message) =>
                session?.SendCommandAsync("room.chat.send", payload: new { message }) ?? Task.CompletedTask;

            Task AddBot() => bindings?.AddBotAsync() ?? Task.CompletedTask;
            Task RemoveBot() => bindings?.RemoveBotAsync() ?? Task.CompletedTask;
            Task AnnouncePlayers() => session == null ? Task.CompletedTask : AnnouncePlayersAsync(session);
            Task AnnounceInfo() => bindings?.RequestInfoAsync() ?? Task.CompletedTask;
            Task TogglePrivacy() => bindings?.TogglePrivacyAsync() ?? Task.CompletedTask;
            Task ToggleRole() => bindings?.ToggleRoleAsync() ?? Task.CompletedTask;

            vm = new GameRoomViewModel(
                placeholderGame,
                onSendChat: SendChat,
                onStart: Start,
                onReset: Reset,
                onQuit: () => ExitAsync(),
                onAddBot: AddBot,
                onRemoveBot: RemoveBot,
                onAnnouncePlayers: AnnouncePlayers,
                onAnnounceInfo: AnnounceInfo,
                onTogglePrivacy: TogglePrivacy,
                onToggleRole: ToggleRole,
                dialogs: _dialogs);
            vm.Status = "Connexion à la table…";

            tableView.DataContext = vm;
            _navigation.Show(tableView);
        }, DispatcherPriority.Normal);

        _ = Task.Run(async () =>
        {
            try
            {
                var connected = await connect(cts.Token).ConfigureAwait(false);
                if (cts.IsCancellationRequested)
                {
                    try { await connected.DisposeAsync().ConfigureAwait(false); } catch { }
                    return;
                }

                session = connected;
                var game = buildGameFromSession(session);

                // Mettre à jour la présence (best-effort).
                try
                {
                    var roomName = session.LastRoomState?.Room?.Name;
                    await _presence.SetTableAsync(session.RoomId, string.IsNullOrWhiteSpace(roomName) ? game.Name : roomName)
                        .ConfigureAwait(false);
                }
                catch
                {
                    // ignore
                }

                await dispatcher.InvokeAsync(() =>
                {
                    if (cts.IsCancellationRequested || Interlocked.CompareExchange(ref isExiting, 0, 0) == 1)
                    {
                        return;
                    }

                    // Si on a ouvert une table existante, remplacer le DataContext par un VM complet basé sur le manifest.
                    if (!ReferenceEquals(placeholderGame, game))
                    {
                        if (tableView == null) return;
                        var newVm = new GameRoomViewModel(
                            game,
                            onSendChat: msg => session.SendCommandAsync("room.chat.send", payload: new { message = msg }),
                            onStart: () => session.SendCommandAsync("room.start", payload: null),
                            onReset: () => session.SendCommandAsync("room.reset", payload: null),
                            onQuit: () => ExitAsync(),
                            onAddBot: () => bindings?.AddBotAsync() ?? Task.CompletedTask,
                            onRemoveBot: () => bindings?.RemoveBotAsync() ?? Task.CompletedTask,
                            onAnnouncePlayers: () => AnnouncePlayersAsync(session),
                            onAnnounceInfo: () => bindings?.RequestInfoAsync() ?? Task.CompletedTask,
                            onTogglePrivacy: () => bindings?.TogglePrivacyAsync() ?? Task.CompletedTask,
                            onToggleRole: () => bindings?.ToggleRoleAsync() ?? Task.CompletedTask,
                            dialogs: _dialogs);
                        newVm.Status = "Connexion à la table…";
                        vm = newVm;
                        tableView.DataContext = vm;
                    }

                    if (tableView == null || vm == null)
                    {
                        return;
                    }

                    var createdMessage = isNew
                        ? $"Table de {game.Name} créée. Ajoutez des bots et commencez à jouer."
                        : $"Table rejointe : {game.Name}.";
                    new GameHistorySink(dispatcher, vm.History, _announcementService).Add(createdMessage);

                    try { _sounds.Play(isNew ? SoundId.RoomOpened : SoundId.RoomJoined); } catch { }

                    bindings = new GameTableBindings(
                        dispatcher: dispatcher,
                        game: game,
                        session: session,
                        tableView: tableView,
                        tableVm: vm,
                        announcements: _announcements,
                        sounds: _sounds,
                        announcementService: _announcementService,
                        createGamePlayVm: () => CreateGamePlayViewModel(session, game),
                        selfUsername: _navigation.CurrentUser?.Username ?? string.Empty);
                    bindings.Attach();
                    bindings.InitializeFromLastState();

                    vm.Status = "Table prête.";

                    onRoomConnectionStateChanged = state =>
                    {
                        if (state is client_win.Modules.Network.WebSockets.WebSocketState.Disconnected or
                            client_win.Modules.Network.WebSockets.WebSocketState.Error)
                        {
                            _ = ExitAsync("Connexion à la table interrompue.");
                        }
                    };
                    session.ConnectionStateChanged += onRoomConnectionStateChanged;
                }, DispatcherPriority.Background);
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur ouverture table (deferred)");
                if (cts.IsCancellationRequested)
                {
                    return;
                }

                try
                {
                    await dispatcher.InvokeAsync(() => _navigation.Show(returnView), DispatcherPriority.Normal);
                    await _dialogs.ShowError("Table", $"Impossible d'ouvrir la table : {ex.Message}")
                        .ConfigureAwait(true);
                }
                catch
                {
                    // ignore
                }
                finally
                {
                }
            }
        });
    }

    private GamePlayViewModel CreateGamePlayViewModel(RoomSession room, CatalogGame game)
    {
        return new GamePlayViewModel(
            gameId: game.Id,
            connect: ct => _games.ConnectAsync(room.RoomId, game.Id, ct),
            dialogs: _dialogs,
            sounds: _sounds);
    }

    private Task AnnouncePlayersAsync(RoomSession session)
    {
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
