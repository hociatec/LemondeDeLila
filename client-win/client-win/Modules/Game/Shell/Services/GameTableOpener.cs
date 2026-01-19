using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.Play.GamePlay.ViewModels;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Social.Services;
using client_win.Modules.TextPrompts.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Game.RoomDirectory.Services;

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
    private readonly IAppAudioCoordinator _audio;
    private readonly IRoomDirectoryClient _directory;
    private readonly ISocialService _social;
    private readonly ITextPromptService _textPrompts;

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
        ISoundService sounds,
        IAppAudioCoordinator audio,
        IRoomDirectoryClient directory,
        ISocialService social,
        ITextPromptService textPrompts)
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
        _audio = audio ?? throw new ArgumentNullException(nameof(audio));
        _directory = directory ?? throw new ArgumentNullException(nameof(directory));
        _social = social ?? throw new ArgumentNullException(nameof(social));
        _textPrompts = textPrompts ?? throw new ArgumentNullException(nameof(textPrompts));
    }

    public async Task OpenAsync(CatalogGame game, object returnContent)
    {
        if (game == null) throw new ArgumentNullException(nameof(game));
        if (returnContent == null) throw new ArgumentNullException(nameof(returnContent));

        await OpenDeferredAsync(
                placeholderGame: game,
                returnContent: returnContent,
                connect: ct => _rooms.CreateAndConnectAsync(game.Id, ct),
                buildGameFromSession: _ => game,
                isNew: true)
            .ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, object returnContent)
    {
        await OpenExistingAsync(roomId, returnContent, spectator: false).ConfigureAwait(true);
    }

    private sealed record RosterEntry(int Id, string Username, bool Spectator);

    private static IReadOnlyList<RosterEntry> BuildRoster(RoomSession session)
    {
        var room = session?.LastRoomState?.Room;
        if (room == null)
        {
            return Array.Empty<RosterEntry>();
        }

        var byId = new Dictionary<int, RosterEntry>();

        foreach (var p in room.Players ?? new List<RoomUserDto>())
        {
            if (p == null || p.Id <= 0) continue;
            var name = (p.Username ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            byId[p.Id] = new RosterEntry(p.Id, name, Spectator: false);
        }

        foreach (var s in room.Spectators ?? new List<RoomUserDto>())
        {
            if (s == null || s.Id <= 0) continue;
            var name = (s.Username ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            byId[s.Id] = new RosterEntry(s.Id, name, Spectator: true);
        }

        return byId.Values
            .OrderBy(x => x.Spectator)
            .ThenBy(x => x.Username, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task InvitePlayerAsync(RoomSession session)
    {
        InvitePresenceListResult listed;
        try
        {
            listed = await _directory.InvitePresenceListAsync(session.RoomId).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowInfo("Invitation", ex.Message).ConfigureAwait(true);
            return;
        }

        var candidates = (listed?.Players ?? Array.Empty<InvitePresenceListItem>())
            .Where(p => p != null && p.Id > 0 && !string.IsNullOrWhiteSpace(p.Username))
            .OrderBy(p => p.Username, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (candidates.Count == 0)
        {
            await _dialogs.ShowInfo("Invitation", "Aucun joueur connecté à inviter.").ConfigureAwait(true);
            return;
        }

        var labels = candidates
            .Select(p =>
            {
                var name = p.Username.Trim();
                var loc = (p.Location ?? string.Empty).Trim();
                var status = p.PendingInvite ? "invitation en attente" : string.Empty;
                if (!string.IsNullOrWhiteSpace(loc) && !string.IsNullOrWhiteSpace(status))
                {
                    return $"{name} ({loc}, {status})";
                }
                if (!string.IsNullOrWhiteSpace(loc))
                {
                    return $"{name} ({loc})";
                }
                if (!string.IsNullOrWhiteSpace(status))
                {
                    return $"{name} ({status})";
                }
                return name;
            })
            .ToList();

        var picked = await _dialogs.Pick(
                "Invitation",
                "Choisir un joueur connecté :",
                labels,
                okText: "Inviter",
                cancelText: "Annuler")
            .ConfigureAwait(true);

        if (picked == null)
        {
            return;
        }

        var idx = labels.IndexOf(picked);
        if (idx < 0 || idx >= candidates.Count)
        {
            return;
        }

        var target = candidates[idx];
        var message = await _directory.InviteSendAsync(session.RoomId, target.Id).ConfigureAwait(true);
        if (!string.IsNullOrWhiteSpace(message))
        {
            await _dialogs.ShowInfo("Invitation", message.Trim()).ConfigureAwait(true);
        }
    }

    private async Task KickPlayerAsync(RoomSession session, bool ban)
    {
        var roster = BuildRoster(session);
        if (roster.Count == 0)
        {
            await _dialogs.ShowInfo("Table", "Aucun joueur.").ConfigureAwait(true);
            return;
        }

        var selfUsername = (_navigation.CurrentUser?.Username ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(selfUsername))
        {
            roster = roster.Where(r => !string.Equals(r.Username, selfUsername, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        if (roster.Count == 0)
        {
            await _dialogs.ShowInfo("Table", "Aucun autre joueur.").ConfigureAwait(true);
            return;
        }

        var title = ban ? "Bannir un joueur" : "Exclure un joueur";
        var action = ban ? "Bannir" : "Exclure";

        var labels = roster
            .Select(r => r.Spectator ? $"{r.Username} (spectateur)" : r.Username)
            .ToList();

        var picked = await _dialogs.Pick(title, "Choisir un joueur :", labels, okText: action, cancelText: "Annuler")
            .ConfigureAwait(true);
        if (picked == null)
        {
            return;
        }

        var idx = labels.IndexOf(picked);
        if (idx < 0 || idx >= roster.Count)
        {
            return;
        }

        var target = roster[idx];
        if (ban)
        {
            var confirm = await _dialogs.Confirm(
                    "Bannir",
                    $"Bannir {target.Username} de cette table ?")
                .ConfigureAwait(true);
            if (confirm != true)
            {
                return;
            }
        }

        await session.SendCommandAsync(ban ? "room.ban" : "room.kick", payload: new { userId = target.Id })
            .ConfigureAwait(true);
    }

    private async Task TransferOwnerAsync(RoomSession session)
    {
        var roster = BuildRoster(session).Where(r => !r.Spectator).ToList();
        var selfUsername = (_navigation.CurrentUser?.Username ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(selfUsername))
        {
            roster = roster.Where(r => !string.Equals(r.Username, selfUsername, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        if (roster.Count == 0)
        {
            await _dialogs.ShowInfo("Table", "Aucun joueur disponible pour devenir proprietaire.").ConfigureAwait(true);
            return;
        }

        var labels = roster.Select(r => r.Username).ToList();
        var picked = await _dialogs.Pick(
                "Changer le proprietaire",
                "Choisir un joueur :",
                labels,
                okText: "Changer",
                cancelText: "Annuler")
            .ConfigureAwait(true);

        if (picked == null)
        {
            return;
        }

        var idx = labels.IndexOf(picked);
        if (idx < 0 || idx >= roster.Count)
        {
            return;
        }

        var target = roster[idx];
        var confirm = await _dialogs.Confirm(
                "Changer le proprietaire",
                $"Donner la table a {target.Username} ?")
            .ConfigureAwait(true);
        if (confirm != true)
        {
            return;
        }

        await session.SendCommandAsync("room.set-owner", payload: new { userId = target.Id }).ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, object returnContent, bool spectator)
    {
        await OpenExistingAsync(roomId, returnContent, spectator, silent: false).ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, object returnContent, bool spectator, bool silent)
    {
        if (roomId <= 0) throw new ArgumentException("roomId invalide", nameof(roomId));
        if (returnContent == null) throw new ArgumentNullException(nameof(returnContent));

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
                returnContent: returnContent,
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
        object returnContent,
        Func<CancellationToken, Task<RoomSession>> connect,
        Func<RoomSession, CatalogGame> buildGameFromSession,
        bool isNew)
    {
        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        var cts = new CancellationTokenSource();
        RoomSession? session = null;
        GameTableBindings? bindings = null;
        Action<client_win.Modules.Network.WebSockets.WebSocketState>? onRoomConnectionStateChanged = null;
        Action<string>? onSessionLeft = null;
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
                if (session != null && onSessionLeft != null)
                {
                    session.Left -= onSessionLeft;
                    onSessionLeft = null;
                }

                try
                {
                    if (bindings != null)
                    {
                        await bindings.DisposeAsync().ConfigureAwait(true);
                        bindings = null;
                        // GameTableBindings.DisposeAsync() ferme la session (Leave + Dispose).
                        session = null;
                    }
                }
                catch
                {
                    // best-effort
                }

                if (session != null)
                {
                    try
                    {
                        using var leaveTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                        await session.LeaveAsync(leaveTimeout.Token).ConfigureAwait(false);
                    }
                    catch
                    {
                        // best-effort
                    }
                    try { await session.DisposeAsync().ConfigureAwait(false); } catch { }
                    session = null;
                }

                try { _sounds.Play(SoundId.RoomExit); } catch { }
                _ = _presence.SetHomeAsync();

                if (!dispatcher.CheckAccess())
                {
                    await dispatcher.InvokeAsync(() => _navigation.Show(returnContent), DispatcherPriority.Normal);
                }
                else
                {
                    _navigation.Show(returnContent);
                }

                // Réactive l'ambiance/musique si on revient vers un écran qui en a une.
                try
                {
                    // Background handled by NavigationAudioSync (based on the shown view).
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

        GameRoomViewModel? vm = null;

        await dispatcher.InvokeAsync(() =>
        {
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
            Task Invite() => session == null ? Task.CompletedTask : InvitePlayerAsync(session);
            Task Kick() => session == null ? Task.CompletedTask : KickPlayerAsync(session, ban: false);
            Task Ban() => session == null ? Task.CompletedTask : KickPlayerAsync(session, ban: true);
            Task TransferOwner() => session == null ? Task.CompletedTask : TransferOwnerAsync(session);

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
                onInvite: Invite,
                onKick: Kick,
                onBan: Ban,
                onTransferOwner: TransferOwner,
                dialogs: _dialogs,
                screenReader: _screenReader,
                announcements: _announcementService);
            vm.Status = "Connexion à la table…";
            vm.IsReconnecting = true;
            vm.GameZone.IsConnected = false;
            vm.Chat.IsConnected = false;

            _navigation.Show(vm);
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
                            onInvite: () => InvitePlayerAsync(session),
                            onKick: () => KickPlayerAsync(session, ban: false),
                            onBan: () => KickPlayerAsync(session, ban: true),
	                            onTransferOwner: () => TransferOwnerAsync(session),
	                            dialogs: _dialogs,
	                            screenReader: _screenReader,
	                            announcements: _announcementService);
	                        newVm.Status = "Connexion à la table…";
	                        newVm.IsReconnecting = true;
	                        newVm.GameZone.IsConnected = false;
	                        newVm.Chat.IsConnected = false;
	                        vm = newVm;
	                        _navigation.Show(vm);
	                    }

                    if (vm == null)
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
                        tableVm: vm,
                        announcements: _announcements,
                        sounds: _sounds,
                        announcementService: _announcementService,
                        createGamePlayVm: () => CreateGamePlayViewModel(session, game),
                        selfUsername: _navigation.CurrentUser?.Username ?? string.Empty);
                    bindings.Attach();
                    bindings.InitializeFromLastState();

                    vm.Status = "Table prête.";
                    vm.IsReconnecting = false;
                    vm.GameZone.IsConnected = true;
                    vm.Chat.IsConnected = true;

                    session.ErrorReceived += message =>
                    {
                        if (string.IsNullOrWhiteSpace(message)) return;
                        var m = message.Trim().ToLowerInvariant();
                        if (m.Contains("exclu") || m.Contains("banni") || m.Contains("banni"))
                        {
                            _ = ExitAsync(message.Trim());
                        }
                    };

                    onSessionLeft = type =>
                    {
                        if (string.Equals(type, "room.deleted", StringComparison.OrdinalIgnoreCase))
                        {
                            _ = ExitAsync("Table fermée.");
                        }
                        else
                        {
                            _ = ExitAsync("Vous avez quitté la table.");
                        }
                    };
                    session.Left += onSessionLeft;

                    onRoomConnectionStateChanged = state =>
                    {
                        if (vm == null)
                        {
                            return;
                        }

                        if (state == client_win.Modules.Network.WebSockets.WebSocketState.Connecting)
                        {
                            vm.Status = "Connexion à la table…";
                            vm.IsReconnecting = true;
                            vm.GameZone.IsConnected = false;
                            vm.Chat.IsConnected = false;
                        }
                        else if (state == client_win.Modules.Network.WebSockets.WebSocketState.Connected)
                        {
                            vm.Status = "Table prête.";
                            vm.IsReconnecting = false;
                            vm.GameZone.IsConnected = true;
                            vm.Chat.IsConnected = true;
                        }
                        else if (state == client_win.Modules.Network.WebSockets.WebSocketState.Disconnected)
                        {
                            vm.Status = "Connexion table perdue. Reconnexion…";
                            vm.IsReconnecting = true;
                            vm.GameZone.IsConnected = false;
                            vm.Chat.IsConnected = false;
                        }
                        else if (state == client_win.Modules.Network.WebSockets.WebSocketState.Error)
                        {
                            vm.Status = "Connexion table en erreur. Reconnexion…";
                            vm.IsReconnecting = true;
                            vm.GameZone.IsConnected = false;
                            vm.Chat.IsConnected = false;
                        }
                    };
                    session.ConnectionStateChanged += onRoomConnectionStateChanged;
                    onRoomConnectionStateChanged(session.State);
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
                    await dispatcher.InvokeAsync(() => _navigation.Show(returnContent), DispatcherPriority.Normal);
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
            textPrompts: _textPrompts,
            sounds: _sounds,
            announcements: _announcementService);
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
