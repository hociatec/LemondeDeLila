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
using client_win.Modules.Game.Play.Services;
using client_win.Modules.Game.Play.ViewModels;
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
    private readonly IRoomAnnouncements _announcements;
    private readonly IGameAnnouncements _gameAnnouncements;
    private readonly IPresenceMonitor _presence;
    private readonly ISoundService _sounds;
    private readonly IHomeViewAccessor _home;

    public GameTableOpener(
        ILogger<GameTableOpener> logger,
        IRoomGatewayClient rooms,
        IGameGatewayClient games,
        INavigationService navigation,
        IDialogService dialogs,
        IScreenReaderAnnouncer screenReader,
        IRoomAnnouncements announcements,
        IGameAnnouncements gameAnnouncements,
        IPresenceMonitor presence,
        ISoundService sounds,
        IHomeViewAccessor home)
    {
        _logger = logger;
        _rooms = rooms;
        _games = games;
        _navigation = navigation;
        _dialogs = dialogs;
        _screenReader = screenReader ?? throw new ArgumentNullException(nameof(screenReader));
        _announcements = announcements;
        _gameAnnouncements = gameAnnouncements;
        _presence = presence ?? throw new ArgumentNullException(nameof(presence));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _home = home ?? throw new ArgumentNullException(nameof(home));
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

        await OpenSessionAsync(session, game, returnView, isNew: true).ConfigureAwait(true);
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

        RoomSession session;
        try
        {
            session = await _rooms.ConnectAsync(roomId, spectator, silent).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur connexion table: roomId={RoomId}", roomId);
            await _dialogs.ShowError("Rejoindre une table", $"Impossible de rejoindre la table : {ex.Message}")
                .ConfigureAwait(true);
            return;
        }

        var payload = session.LastRoomState;
        var manifest = payload?.Manifest;
        var gameType = payload?.Room?.GameType;
        var name = manifest?.Name;
        var min = manifest?.MinPlayers ?? 1;
        var max = manifest?.MaxPlayers ?? 8;

        var game = new CatalogGame(
            code: string.IsNullOrWhiteSpace(gameType) ? "unknown" : gameType!,
            name: string.IsNullOrWhiteSpace(name) ? $"Table #{roomId}" : name!,
            summary: string.Empty,
            minPlayers: min,
            maxPlayers: max,
            engine: string.Empty,
            categories: Array.Empty<string>());

        await OpenSessionAsync(session, game, returnView, isNew: false).ConfigureAwait(true);
    }

    private async Task OpenSessionAsync(RoomSession session, CatalogGame game, UserControl returnView, bool isNew)
    {
        var roomName = session.LastRoomState?.Room?.Name;
        await _presence.SetTableAsync(session.RoomId, string.IsNullOrWhiteSpace(roomName) ? game.Name : roomName)
            .ConfigureAwait(true);

        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        if (!dispatcher.CheckAccess())
        {
            await dispatcher.InvokeAsync(
                () => OpenSessionUi(session, game, returnView, isNew),
                DispatcherPriority.Normal);
            return;
        }

        OpenSessionUi(session, game, returnView, isNew);
    }

    private void OpenSessionUi(RoomSession session, CatalogGame game, UserControl returnView, bool isNew)
    {
        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        var tableView = new GameRoomView();
        tableView.SetScreenReader(_screenReader);

        GameTableBindings? bindings = null;
        Action<client_win.Modules.Network.WebSockets.WebSocketState>? onRoomConnectionStateChanged = null;
        var isExiting = 0;

        async Task ExitToTavernAsync(string? reason = null)
        {
            if (Interlocked.Exchange(ref isExiting, 1) == 1)
            {
                return;
            }

            try
            {
                if (onRoomConnectionStateChanged != null)
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
                    // Best-effort; le backend ferme la table quand la dernière connexion sort.
                }

                _ = _presence.SetHomeAsync();

                // Navigation + éventuel message : toujours sur le thread UI.
                var target = returnView;
                if (!dispatcher.CheckAccess())
                {
                    await dispatcher.InvokeAsync(() => _navigation.Show(target), DispatcherPriority.Normal);
                }
                else
                {
                    _navigation.Show(target);
                }

                // Réactive l'ambiance/musique si on revient vers un écran qui en a une.
                try
                {
                    _sounds.StopLoop(SoundId.MainMenuMusic);
                    _sounds.StopLoop(SoundId.TavernAmbience);
                    if (target is CatalogView)
                    {
                        _sounds.StartLoop(SoundId.TavernAmbience);
                    }
                    else if (target is MainMenuView)
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
                    try
                    {
                        await _dialogs.ShowInfo("Table", reason.Trim()).ConfigureAwait(true);
                    }
                    catch
                    {
                        // ignore
                    }
                }
            }
            finally
            {
                // Autorise une future sortie si cette instance est réutilisée (par prudence).
                Interlocked.Exchange(ref isExiting, 0);
            }
        }

        Task Start() => session.SendCommandAsync("room.start", payload: null);
        Task Reset() => session.SendCommandAsync("room.reset", payload: null);
        Task SendChat(string message) => session.SendCommandAsync("room.chat.send", payload: new { message });
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

        var vm = new GameRoomViewModel(
            game,
            onSendChat: SendChat,
            onStart: Start,
            onReset: Reset,
            onQuit: async () =>
            {
                _sounds.Play(SoundId.RoomExit);
                await ExitToTavernAsync().ConfigureAwait(true);
            },
            onAddBot: AddBot,
            onRemoveBot: RemoveBot,
            onAnnouncePlayers: AnnouncePlayers,
            onAnnounceInfo: AnnounceInfo,
            onTogglePrivacy: TogglePrivacy,
            onToggleRole: ToggleRole,
            dialogs: _dialogs);

        vm.Chat.SelfUsername = _navigation.CurrentUser?.Username ?? string.Empty;
        vm.Chat.LocalEcho = msg =>
        {
            var who = string.IsNullOrWhiteSpace(vm.Chat.SelfUsername) ? "Moi" : vm.Chat.SelfUsername.Trim();
            vm.History.Entries.Add($"Chat — {who} : {msg}");
            if (vm.Chat.IsSoundsEnabled)
            {
                _sounds.Play(SoundId.ChatMessageSent);
            }
        };

        var createdMessage = isNew
            ? $"Table de {game.Name} créée. Ajoutez des bots et commencez à jouer."
            : $"Table rejointe : {game.Name}.";
        foreach (var line in GameHistoryMessageSplitter.Split(createdMessage))
        {
            vm.History.Entries.Add(line);
        }
        _gameAnnouncements.Info(createdMessage);
        _sounds.Play(isNew ? SoundId.RoomOpened : SoundId.RoomJoined);

        bindings = new GameTableBindings(
            dispatcher: dispatcher,
            game: game,
            session: session,
            tableView: tableView,
            tableVm: vm,
            announcements: _announcements,
            sounds: _sounds,
            createGamePlayVm: () => CreateGamePlayViewModel(session, game),
            selfUsername: _navigation.CurrentUser?.Username ?? string.Empty);
        bindings.Attach();
        bindings.InitializeFromLastState();

        tableView.DataContext = vm;
        _navigation.Show(tableView);

        // Si le WS room est fermé (ex: table supprimée / serveur coupe la connexion),
        // revenir automatiquement à la vue de retour au lieu de laisser l'utilisateur sur un écran "mort".
        onRoomConnectionStateChanged = state =>
        {
            if (state is client_win.Modules.Network.WebSockets.WebSocketState.Disconnected or
                client_win.Modules.Network.WebSockets.WebSocketState.Error)
            {
                _ = ExitToTavernAsync("Connexion à la table interrompue.");
            }
        };
        session.ConnectionStateChanged += onRoomConnectionStateChanged;
    }

    private GamePlayViewModel CreateGamePlayViewModel(RoomSession room, CatalogGame game)
    {
        return new GamePlayViewModel(
            connect: ct => _games.ConnectAsync(room.RoomId, game.Id, ct),
            dialogs: _dialogs,
            sounds: _sounds,
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
