using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using client_win.Core.Network;
using client_win.Modules.Game.Common;
using client_win.Modules.Config;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.Play.GamePlay.ViewModels;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Social.Services;
using client_win.Modules.Settings.Models;
using client_win.Modules.Settings.Services;
using client_win.Modules.User.Services;
using client_win.Modules.TextPrompts.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Game.Room.Lobby.Services;
using client_win.Modules.Game.Room.Lobby.ViewModels;
using client_win.Modules.Vault.Services;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Catalog.ViewModels;
using client_win.Modules.MainMenu.ViewModels;
using client_win.Modules.Vault.ViewModels;

namespace client_win.Modules.Game.Shell.Services;

public sealed class GameTableOpener : IGameTableOpener
{
    private readonly ILogger<GameTableOpener> _logger;
    private readonly ClientConfiguration _config;
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
    private readonly IRemoteSoundCache _remoteSounds;
    private readonly IOptionsService _options;
    private readonly ISessionService _sessionService;
    private readonly IRoomLobbyClient _directory;
    private readonly ISocialService _social;
    private readonly ITextPromptService _textPrompts;
    private readonly IVaultClient _vault;
    private readonly ICatalogService _catalog;
    private readonly IGameFocusCoordinator _focus;
    private readonly IHomeViewAccessor _homeAccessor;
    private static int _globalSoundsPreloaded;
    private static readonly object _tableAmbienceLabelsCacheGate = new();
    private static Dictionary<string, string>? _tableAmbienceLabelsCache;
    private static DateTimeOffset _tableAmbienceLabelsCacheUntil = DateTimeOffset.MinValue;
    private static Task<Dictionary<string, string>>? _tableAmbienceLabelsInFlight;

    public GameTableOpener(
        ILogger<GameTableOpener> logger,
        ClientConfiguration config,
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
        IRemoteSoundCache remoteSounds,
        IOptionsService options,
        ISessionService sessionService,
        IRoomLobbyClient directory,
        ISocialService social,
        ITextPromptService textPrompts,
        IVaultClient vault,
        ICatalogService catalog,
        IGameFocusCoordinator focus,
        IHomeViewAccessor homeAccessor)
    {
        _logger = logger;
        _config = config ?? throw new ArgumentNullException(nameof(config));
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
        _remoteSounds = remoteSounds ?? throw new ArgumentNullException(nameof(remoteSounds));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _sessionService = sessionService ?? throw new ArgumentNullException(nameof(sessionService));
        _directory = directory ?? throw new ArgumentNullException(nameof(directory));
        _social = social ?? throw new ArgumentNullException(nameof(social));
        _textPrompts = textPrompts ?? throw new ArgumentNullException(nameof(textPrompts));
        _vault = vault ?? throw new ArgumentNullException(nameof(vault));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _focus = focus ?? throw new ArgumentNullException(nameof(focus));
        _homeAccessor = homeAccessor ?? throw new ArgumentNullException(nameof(homeAccessor));
    }

    private IAnnouncementService AnnouncementService => _announcementService ?? throw new InvalidOperationException("Le service d'annonces n'est pas disponible.");

    private sealed class TableAmbienceFileDto
    {
        public TableAmbienceItemDto[]? Items { get; set; }
    }

    private sealed class TableAmbienceItemDto
    {
        public string? SoundId { get; set; }
        public string? Name { get; set; }
    }

    private async Task<Dictionary<string, string>> FetchTableAmbienceLabelsAsync(CancellationToken cancellationToken)
    {
        Dictionary<string, string>? cached = null;
        Task<Dictionary<string, string>>? inFlight = null;
        lock (_tableAmbienceLabelsCacheGate)
        {
            if (_tableAmbienceLabelsCache != null && DateTimeOffset.UtcNow < _tableAmbienceLabelsCacheUntil)
            {
                cached = new Dictionary<string, string>(_tableAmbienceLabelsCache, StringComparer.OrdinalIgnoreCase);
            }
            else if (_tableAmbienceLabelsInFlight != null)
            {
                inFlight = _tableAmbienceLabelsInFlight;
            }
            else
            {
                _tableAmbienceLabelsInFlight = FetchTableAmbienceLabelsCoreAsync(cancellationToken);
                inFlight = _tableAmbienceLabelsInFlight;
            }
        }

        if (cached != null)
        {
            return cached;
        }

        var fetched = await (inFlight ?? FetchTableAmbienceLabelsCoreAsync(cancellationToken)).ConfigureAwait(false);
        lock (_tableAmbienceLabelsCacheGate)
        {
            if (ReferenceEquals(_tableAmbienceLabelsInFlight, inFlight))
            {
                _tableAmbienceLabelsInFlight = null;
            }

            if (fetched.Count > 0)
            {
                _tableAmbienceLabelsCache = new Dictionary<string, string>(fetched, StringComparer.OrdinalIgnoreCase);
                _tableAmbienceLabelsCacheUntil = DateTimeOffset.UtcNow.AddMinutes(2);
                return new Dictionary<string, string>(_tableAmbienceLabelsCache, StringComparer.OrdinalIgnoreCase);
            }

            if (_tableAmbienceLabelsCache != null)
            {
                return new Dictionary<string, string>(_tableAmbienceLabelsCache, StringComparer.OrdinalIgnoreCase);
            }

            _tableAmbienceLabelsCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            _tableAmbienceLabelsCacheUntil = DateTimeOffset.UtcNow.AddSeconds(20);
            return new Dictionary<string, string>(_tableAmbienceLabelsCache, StringComparer.OrdinalIgnoreCase);
        }
    }

    private async Task<Dictionary<string, string>> FetchTableAmbienceLabelsCoreAsync(CancellationToken cancellationToken)
    {
        try
        {
            var endpoint = new Uri(_config.HttpBase, "sounds/table-ambiences");
            using var req = new HttpRequestMessage(HttpMethod.Get, endpoint);
            using var res = await HttpClientProvider.Shared
                .SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                .ConfigureAwait(false);
            if (!res.IsSuccessStatusCode)
            {
                return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }

            var json = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var dto = JsonSerializer.Deserialize<TableAmbienceFileDto>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            var items = dto?.Items ?? Array.Empty<TableAmbienceItemDto>();

            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var it in items)
            {
                var id = (it?.SoundId ?? string.Empty).Trim();
                var name = (it?.Name ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }
                map[id] = name;
            }
            return map;
        }
        catch
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }

    public async Task OpenAsync(CatalogGame game, object returnContent)
    {
        if (game == null) throw new ArgumentNullException(nameof(game));
        if (returnContent == null) throw new ArgumentNullException(nameof(returnContent));

        // Table-only controls (volume/enable) should not leak across new table creation.
        // Reset to defaults when creating a new room.
        try
        {
            var defaults = new OptionsState();
            var state = _options.Current;
            if (state.SoundTableAmbience != defaults.SoundTableAmbience ||
                state.SoundTableAmbienceVolume != defaults.SoundTableAmbienceVolume)
            {
                state.SoundTableAmbience = defaults.SoundTableAmbience;
                state.SoundTableAmbienceVolume = defaults.SoundTableAmbienceVolume;
                _options.Update(state);
            }
        }
        catch
        {
            // best-effort
        }

        await OpenDeferredAsync(
                placeholderGame: game,
                returnContent: returnContent,
                connect: ct => _rooms.CreateAndConnectAsync(game.Id, ct),
                buildGameFromSession: _ => game,
                isNew: true,
                silent: false,
                vaultSnapshotId: null)
            .ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, object returnContent)
    {
        await OpenExistingAsync(roomId, returnContent, spectator: false).ConfigureAwait(true);
    }

    private enum RosterEntryKind
    {
        Player,
        Spectator,
        Bot
    }

    private sealed record RosterEntry(int Id, string Name, RosterEntryKind Kind);

    private static IReadOnlyList<RosterEntry> BuildRoster(IRoomSession session)
    {
        var room = session?.LastRoomState?.Room;
        if (room == null)
        {
            return Array.Empty<RosterEntry>();
        }

        var byKey = new Dictionary<string, RosterEntry>(StringComparer.Ordinal);

        foreach (var p in room.Players ?? new List<RoomUserDto>())
        {
            if (p == null || p.Id <= 0) continue;
            var name = (p.Username ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            byKey[$"user:{p.Id}"] = new RosterEntry(p.Id, name, RosterEntryKind.Player);
        }

        foreach (var s in room.Spectators ?? new List<RoomUserDto>())
        {
            if (s == null || s.Id <= 0) continue;
            var name = (s.Username ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            byKey[$"user:{s.Id}"] = new RosterEntry(s.Id, name, RosterEntryKind.Spectator);
        }

        foreach (var b in room.Bots ?? new List<RoomBotDto>())
        {
            if (b == null || b.Id <= 0) continue;
            var name = (b.Name ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            byKey[$"bot:{b.Id}"] = new RosterEntry(b.Id, name, RosterEntryKind.Bot);
        }

        return byKey.Values
            .OrderBy(x => x.Kind)
            .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task InvitePlayerAsync(IRoomSession session)
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

    private async Task KickPlayerAsync(IRoomSession session, bool ban)
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
            roster = roster
                .Where(r => r.Kind == RosterEntryKind.Bot ||
                            !string.Equals(r.Name, selfUsername, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
        if (roster.Count == 0)
        {
            await _dialogs.ShowInfo("Table", "Aucun autre joueur.").ConfigureAwait(true);
            return;
        }

        if (ban)
        {
            roster = roster.Where(r => r.Kind != RosterEntryKind.Bot).ToList();
        }

        if (roster.Count == 0)
        {
            await _dialogs.ShowInfo("Table", "Aucun joueur à exclure/bannir.").ConfigureAwait(true);
            return;
        }

        var title = ban ? "Bannir un joueur" : "Exclure un joueur ou bot";
        var action = ban ? "Bannir" : "Exclure";

        var labels = roster
            .Select(r => r.Kind switch
            {
                RosterEntryKind.Spectator => $"{r.Name} (spectateur)",
                RosterEntryKind.Bot => $"{r.Name} (bot)",
                _ => r.Name
            })
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
                    $"Bannir {target.Name} de cette table ?")
                .ConfigureAwait(true);
            if (confirm != true)
            {
                return;
            }
        }

        if (target.Kind == RosterEntryKind.Bot)
        {
            await session.SendCommandAwaitAckAsync(
                    "bot.remove",
                    payload: new { botId = target.Id })
                .ConfigureAwait(true);
            return;
        }

        await session.SendCommandAwaitAckAsync(
                ban ? "room.ban" : "room.kick",
                payload: new { userId = target.Id })
            .ConfigureAwait(true);
    }

    private async Task TransferOwnerAsync(IRoomSession session)
    {
        var roster = BuildRoster(session).Where(r => r.Kind == RosterEntryKind.Player).ToList();
        var selfUsername = (_navigation.CurrentUser?.Username ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(selfUsername))
        {
            roster = roster.Where(r => !string.Equals(r.Name, selfUsername, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        if (roster.Count == 0)
        {
            await _dialogs.ShowInfo("Table", "Aucun joueur disponible pour devenir proprietaire.").ConfigureAwait(true);
            return;
        }

        var labels = roster.Select(r => r.Name).ToList();
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
                $"Donner la table a {target.Name} ?")
            .ConfigureAwait(true);
        if (confirm != true)
        {
            return;
        }

        await session.SendCommandAwaitAckAsync(
                "room.set-owner",
                payload: new { userId = target.Id })
            .ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, object returnContent, bool spectator)
    {
        await OpenExistingAsync(roomId, returnContent, spectator, silent: false).ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, object returnContent, bool spectator, bool silent)
    {
        await OpenExistingAsync(roomId, returnContent, spectator, silent, vaultSnapshotId: null).ConfigureAwait(true);
    }

    public async Task OpenExistingAsync(int roomId, object returnContent, bool spectator, bool silent, string? vaultSnapshotId)
    {
        if (roomId <= 0) throw new ArgumentException("roomId invalide", nameof(roomId));
        if (returnContent == null) throw new ArgumentNullException(nameof(returnContent));

        // Restore per-snapshot local table ambience prefs (volume/enable), if any.
        TryApplyTableAmbiencePrefsForSnapshot(vaultSnapshotId);

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
                isNew: false,
                silent: silent,
                vaultSnapshotId: vaultSnapshotId)
            .ConfigureAwait(true);
    }

    private void TryApplyTableAmbiencePrefsForSnapshot(string? vaultSnapshotId)
    {
        var id = (vaultSnapshotId ?? string.Empty).Trim();
        if (id.Length == 0)
        {
            return;
        }

        try
        {
            var state = _options.Current;
            var map = state.TableAmbiencePrefsByVaultSnapshotId;
            if (map == null || !map.TryGetValue(id, out var prefs) || prefs == null)
            {
                return;
            }

            var nextEnabled = prefs.Enabled;
            var nextVolume = Math.Max(0, Math.Min(100, prefs.Volume));
            if (state.SoundTableAmbience == nextEnabled && state.SoundTableAmbienceVolume == nextVolume)
            {
                return;
            }

            state.SoundTableAmbience = nextEnabled;
            state.SoundTableAmbienceVolume = nextVolume;
            _options.Update(state);
        }
        catch
        {
            // best-effort
        }
    }

    private void TryPersistTableAmbiencePrefsForSnapshot(string? vaultSnapshotId)
    {
        var id = (vaultSnapshotId ?? string.Empty).Trim();
        if (id.Length == 0)
        {
            return;
        }

        try
        {
            var state = _options.Current;
            state.TableAmbiencePrefsByVaultSnapshotId ??= new();

            var enabled = state.SoundTableAmbience;
            var volume = Math.Max(0, Math.Min(100, state.SoundTableAmbienceVolume));
            state.TableAmbiencePrefsByVaultSnapshotId[id] = new OptionsState.TableAmbienceSnapshotPrefs
            {
                Enabled = enabled,
                Volume = volume
            };
            _options.Update(state);
        }
        catch
        {
            // best-effort
        }
    }

    private async Task OpenDeferredAsync(
        CatalogGame placeholderGame,
        object returnContent,
        Func<CancellationToken, Task<IRoomSession>> connect,
        Func<IRoomSession, CatalogGame> buildGameFromSession,
        bool isNew,
        bool silent,
        string? vaultSnapshotId)
    {
        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        var cts = new CancellationTokenSource();
        IRoomSession? session = null;
        GameTableBindings? bindings = null;
        Action<client_win.Modules.Network.WebSockets.WebSocketState>? onRoomConnectionStateChanged = null;
        Action<string>? onSessionLeft = null;
        var isExiting = 0;
        var playedEarlyOpenSound = 0;

        // Warm-up the exit sound immediately so quitting right after opening doesn't feel laggy.
        // IMPORTANT: do it synchronously on the audio dispatcher (no queued BeginInvoke), otherwise a very fast quit
        // can happen before the preload runs.
        try { _sounds.PreloadImmediate(SoundId.RoomExit, warmUp: true); } catch { /* ignore */ }

        // UX: joining/restoring a table can feel "silent" while the first network/session handshake happens.
        // Play the open/join one-shot immediately (best-effort) so the user gets instant feedback.
        // This runs outside the UI dispatcher to avoid races (fast connect) that can trigger double-play/cutoffs.
        if (!silent)
        {
            var earlySound = isNew ? SoundId.RoomOpened : SoundId.RoomJoined;
            try
            {
                _sounds.Preload(earlySound, warmUp: true);
                _sounds.Play(earlySound);
                Interlocked.Exchange(ref playedEarlyOpenSound, 1);
            }
            catch
            {
                Interlocked.Exchange(ref playedEarlyOpenSound, 0);
            }
        }

        async Task ExitAsync(string? reason = null, bool forceTavern = false)
        {
            if (Interlocked.Exchange(ref isExiting, 1) == 1)
            {
                return;
            }

            try
            {
                try { cts.Cancel(); } catch { }
                try { _announcementService?.CancelPending(cancelSpeech: true); } catch { }

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
                        using var leaveTimeout = new CancellationTokenSource(GameTiming.Room.LeaveTimeout);
                        await session.LeaveAsync(leaveTimeout.Token).ConfigureAwait(false);
                    }
                    catch
                    {
                        // best-effort
                    }
                    try { await session.DisposeAsync().ConfigureAwait(false); } catch { }
                    session = null;
                }

                try
                {
                    _sounds.PreloadImmediate(SoundId.RoomExit, warmUp: true);
                    _sounds.Play(SoundId.RoomExit);
                }
                catch { }
                async Task PushPresenceExitContextAsync()
                {
                    try
                    {
                        if (forceTavern)
                        {
                            await _presence.SetContextAsync("tavern").ConfigureAwait(true);

                            // Anti-race: after socket churn (room/game reconnect/close), replay tavern context once.
                            _ = Task.Run(async () =>
                            {
                                try
                                {
                                    await Task.Delay(GameTiming.Table.PresenceReplayDelay).ConfigureAwait(false);
                                    await _presence.SetContextAsync("tavern").ConfigureAwait(false);
                                }
                                catch
                                {
                                    // ignore
                                }
                            });
                        }
                        else
                        {
                            await _presence.SetHomeAsync().ConfigureAwait(true);
                        }
                    }
                    catch
                    {
                        // best effort
                    }
                }

                await PushPresenceExitContextAsync().ConfigureAwait(true);

                object BuildTavernFallback()
                {
                    // Après une sortie de table, la taverne est un "hub" et ne doit pas servir de back-stack vers
                    // des vues modales (ex: Mon coffre fort). Fermer la taverne doit ramener au menu principal.
                    var safeReturn = returnContent is MainMenuViewModel ? returnContent : null;
                    var homeContent = _homeAccessor.HomeContent;

                    CatalogViewModel? catalogVm = null;
                    catalogVm = new CatalogViewModel(
                        _catalog,
                        _options,
                        _sessionService,
                        onClose: () =>
                        {
                            try { catalogVm?.Dispose(); } catch { /* ignore */ }
                            switch (safeReturn)
                            {
                                case CatalogViewModel catalogReturn when catalogReturn.CloseCommand.CanExecute(null):
                                    try { catalogReturn.CloseCommand.Execute(null); } catch { /* ignore */ }
                                    break;
                                case not null:
                                    try { _navigation.Show(safeReturn); } catch { /* ignore */ }
                                    break;
                                default:
                                    if (homeContent != null && !ReferenceEquals(homeContent, catalogVm))
                                    {
                                        try { _navigation.Show(homeContent); } catch { /* ignore */ }
                                    }
                                    break;
                            }
                        },
                        openGame: async game =>
                        {
                            if (catalogVm == null) return;
                            await OpenAsync(game, catalogVm).ConfigureAwait(true);
                        },
                        joinGame: () =>
                        {
                            if (catalogVm == null) return Task.FromResult("Impossible d'ouvrir Rejoindre une table.");

                            JoinGameViewModel? tavernVm = null;
                            tavernVm = new JoinGameViewModel(
                                rooms: _directory,
                                tables: this,
                                announcements: AnnouncementService,
                                returnContent: () => catalogVm,
                                onClose: () =>
                                {
                                    try { tavernVm?.Dispose(); } catch { /* ignore */ }
                                    try { _navigation.Show(catalogVm); } catch { /* ignore */ }
                                });
                            _navigation.Show(tavernVm);
                            return Task.FromResult("Rejoindre une table ouvert.");
                        },
                        openVault: () =>
                        {
                            if (catalogVm == null) return Task.FromResult("Impossible d'ouvrir Mon coffre fort.");

                            VaultViewModel? vaultVm = null;
                            vaultVm = new VaultViewModel(
                                _vault,
                                this,
                                _dialogs,
                                AnnouncementService,
                                returnContent: () => catalogVm,
                                onClose: () =>
                                {
                                    try { vaultVm?.Dispose(); } catch { /* ignore */ }
                                    try { _navigation.Show(catalogVm); } catch { /* ignore */ }
                                });

                            _navigation.Show(vaultVm);
                            return Task.FromResult("Mon coffre fort ouvert.");
                        });

                    return catalogVm;
                }

                void Navigate()
                {
                    try
                    {
                        if (forceTavern)
                        {
                            _navigation.Show(BuildTavernFallback());
                        }
                        else if (returnContent is GameRoomViewModel)
                        {
                            _navigation.Show(BuildTavernFallback());
                        }
                        else
                        {
                            _navigation.Show(returnContent);
                        }
                    }
                    catch
                    {
                        // Fallback de sécurité : si le retour vers l'écran précédent est impossible,
                        // ouvrir la liste des tables publiques plutôt que de laisser un "écran vide".
                        _navigation.Show(BuildTavernFallback());
                    }
                }

                if (!dispatcher.CheckAccess())
                {
                    await dispatcher.InvokeAsync(Navigate, DispatcherPriority.Normal);
                }
                else
                {
                    Navigate();
                }

                if (forceTavern)
                {
                    // Ensure "tavern" wins after navigation-level context updates.
                    await PushPresenceExitContextAsync().ConfigureAwait(true);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur critique lors de la sortie de la table");
            }
            finally
            {
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
                Interlocked.Exchange(ref isExiting, 0);
            }
        }

        var boundSnapshotId = string.IsNullOrWhiteSpace(vaultSnapshotId) ? null : vaultSnapshotId.Trim();

        async Task SaveSnapshot()
        {
            var current = session;
            if (current == null)
            {
                await _dialogs.ShowError("Sauvegarde", "Impossible de sauvegarder (connexion indisponible).")
                    .ConfigureAwait(true);
                return;
            }

            try
            {
                boundSnapshotId = await _vault.SaveAsync(current.RoomId, boundSnapshotId).ConfigureAwait(true);
                TryPersistTableAmbiencePrefsForSnapshot(boundSnapshotId);
                _announcementService.Enqueue(
                    "Table sauvegardée dans Mon coffre fort. Retour à la taverne.",
                    AnnouncementPriority.Polite);
                await ExitAsync(null, forceTavern: true).ConfigureAwait(true);
            }
            catch (Exception ex)
            {
                await _dialogs.ShowError("Sauvegarde", ex.Message).ConfigureAwait(true);
            }
        }

        async Task QuitRoom()
        {
            var current = session;
            var isRestoredFromVault = !string.IsNullOrWhiteSpace(boundSnapshotId);
            if (current != null && isRestoredFromVault)
            {
                try
                {
                    await _vault.AbandonAsync(current.RoomId).ConfigureAwait(true);
                }
                catch
                {
                    // best-effort: si ça échoue, on quitte quand même.
                }
            }

            // Quitter une table depuis l'UI doit toujours ramener à la taverne (même si on vient d'une autre vue).
            await ExitAsync(forceTavern: true).ConfigureAwait(true);
        }

        GameRoomViewModel? vm = null;
        Func<Task>? startHandler = null;
        Task<TableGameConfigWindow.Prompt?>? preloadedStartConfigPromptTask = null;
        string preloadedStartConfigPromptGameType = string.Empty;
        Task<System.Collections.Generic.List<TableAmbiencePickerWindow.Choice>>? preloadedAmbienceChoicesTask = null;
        void TryStartConfigPreloads(IRoomSession currentSession, CatalogGame currentGame)
        {
            try
            {
                var roomNow = currentSession.LastRoomState?.Room;
                var canStartNow = RoomAllowedActions.Contains(roomNow, "room.start");
                var alreadyStartedNow =
                    string.Equals(roomNow?.Status, "started", StringComparison.OrdinalIgnoreCase) ||
                    !string.IsNullOrWhiteSpace(roomNow?.StartedAt);
                var gameTypeNow = (currentGame?.Id ?? string.Empty).Trim();

                if (canStartNow && !alreadyStartedNow && !string.IsNullOrWhiteSpace(gameTypeNow))
                {
                    preloadedStartConfigPromptGameType = gameTypeNow;
                    preloadedStartConfigPromptTask = PreloadStartConfigPromptAtTableOpenAsync(
                        currentSession.RoomId,
                        gameTypeNow,
                        cts.Token);
                    if (preloadedAmbienceChoicesTask == null ||
                        preloadedAmbienceChoicesTask.IsCanceled ||
                        preloadedAmbienceChoicesTask.IsFaulted)
                    {
                        preloadedAmbienceChoicesTask = BuildStartConfigAmbienceChoicesAsync(cts.Token);
                    }
                }
                else
                {
                    preloadedStartConfigPromptTask = null;
                    preloadedStartConfigPromptGameType = string.Empty;
                }
            }
            catch
            {
                preloadedStartConfigPromptTask = null;
                preloadedStartConfigPromptGameType = string.Empty;
                if (preloadedAmbienceChoicesTask == null ||
                    preloadedAmbienceChoicesTask.IsCanceled ||
                    preloadedAmbienceChoicesTask.IsFaulted)
                {
                    preloadedAmbienceChoicesTask = BuildStartConfigAmbienceChoicesAsync(cts.Token);
                }
            }
        }

        async Task ShowRulesAsync()
        {
            if (session == null)
            {
                try { await _dialogs.ShowInfo("Règles", "Connexion à la table...").ConfigureAwait(true); } catch { }
                return;
            }

            GameSession? gameSession = null;
            string? errorDetail = null;
            try
            {
                var gameType = (vm?.Game?.Id ?? placeholderGame.Id ?? string.Empty).Trim();
                var gameName = (vm?.Game?.Name ?? placeholderGame.Name ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(gameType))
                {
                    throw new InvalidOperationException("Type de jeu introuvable.");
                }

                using var timeout = new CancellationTokenSource(GameTiming.Table.RulesConnectTimeout);
                gameSession = await _games.ConnectAsync(session.RoomId, gameType, timeout.Token)
                    .ConfigureAwait(false);

                var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
                void OnRules(GameRulesPayloadDto dto)
                {
                    if (!string.Equals(dto.GameType, gameType, StringComparison.OrdinalIgnoreCase))
                    {
                        return;
                    }
                    tcs.TrySetResult(dto.Rules ?? string.Empty);
                }

                void OnError(string message)
                {
                    if (string.IsNullOrWhiteSpace(message))
                    {
                        return;
                    }
                    errorDetail = message.Trim();
                }

                gameSession.ErrorReceived += OnError;
                gameSession.RulesReceived += OnRules;
                try
                {
                    await gameSession.RequestRulesAsync(timeout.Token).ConfigureAwait(false);
                    var completed = await Task.WhenAny(tcs.Task, Task.Delay(GameTiming.Table.RulesResponseTimeout, timeout.Token))
                        .ConfigureAwait(false);
                    if (completed != tcs.Task)
                    {
                        throw new TimeoutException("Règles : délai dépassé.");
                    }

                    var rules = await tcs.Task.ConfigureAwait(false);
                    await dispatcher.InvokeAsync(() =>
                    {
                        GameRulesWindow.Show(
                            owner: Application.Current?.MainWindow,
                            title: $"Règles - {gameName}",
                            rules: rules);
                    }, DispatcherPriority.Normal).Task.ConfigureAwait(false);
                }
                finally
                {
                    gameSession.RulesReceived -= OnRules;
                    gameSession.ErrorReceived -= OnError;
                }
            }
            catch (Exception ex)
            {
                var detail = string.IsNullOrWhiteSpace(errorDetail) ? ex.Message : errorDetail;
                try { await _dialogs.ShowInfo("Règles", $"Impossible de charger les règles.\nDétail: {detail}").ConfigureAwait(true); } catch { }
            }
            finally
            {
                if (gameSession != null)
                {
                    try { await gameSession.DisposeAsync().ConfigureAwait(false); } catch { }
                }
            }
        }

        async Task ConfigureTableAmbienceAsync()
        {
            if (session == null)
            {
                try { await _dialogs.ShowInfo("Ambiance", "Connexion à la table...").ConfigureAwait(true); } catch { }
                return;
            }

            try
            {
                await _remoteSounds.RefreshAsync(force: false).ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }

            var current = session.LastRoomState?.Room?.TableAmbienceSoundId;

            var choices = new System.Collections.Generic.List<TableAmbiencePickerWindow.Choice>
            {
                new(string.Empty, "Silence (aucune ambiance)")
            };

            var labels = await FetchTableAmbienceLabelsAsync(CancellationToken.None).ConfigureAwait(true);
            if (labels.Count > 0)
            {
                foreach (var kv in labels.OrderBy(k => k.Value, StringComparer.OrdinalIgnoreCase))
                {
                    var id = kv.Key;
                    var name = kv.Value;
                    var configured = Enum.TryParse<SoundId>(id, ignoreCase: true, out var sound) &&
                                     _remoteSounds.TryGetPath(sound) != null;
                    choices.Add(new TableAmbiencePickerWindow.Choice(
                        id,
                        configured ? name : $"{name} (non configurée)"));
                }
            }
            else
            {
                // Compat: si le serveur ne supporte pas encore les ambiances nommées.
                for (var i = 1; i <= 0; i++)
                {
                    var id = $"TableAmbience{i}";
                    var configured = Enum.TryParse<SoundId>(id, ignoreCase: true, out var sound) &&
                                     _remoteSounds.TryGetPath(sound) != null;
                    choices.Add(new TableAmbiencePickerWindow.Choice(
                        id,
                        configured ? $"Ambiance {i} (configurée)" : $"Ambiance {i} (non configurée)"));
                }
            }

            var selected = TableAmbiencePickerWindow.Pick(
                owner: Application.Current?.MainWindow,
                currentSoundId: current,
                choices: choices,
                soundService: _sounds);

            if (selected == null)
            {
                return;
            }

            try
            {
                // Convention: empty string clears the ambience (silence).
                await session.SendCommandAwaitAckAsync(
                        "room.set-ambience",
                        payload: new { soundId = selected })
                    .ConfigureAwait(true);
            }
            catch
            {
                try { await _dialogs.ShowError("Ambiance", "Impossible de mettre à jour l'ambiance.").ConfigureAwait(true); } catch { }
            }
        }

        Task ConfigureTableAmbienceVolumeAsync()
        {
            try
            {
                TableAmbienceVolumeWindow.Show(
                    owner: Application.Current?.MainWindow,
                    initialEnabled: _options.Current.SoundTableAmbience,
                    initialVolume: _options.Current.SoundTableAmbienceVolume,
                    onSave: (enabled, volume) =>
                    {
                        var s = _options.Current;
                        s.SoundTableAmbience = enabled;
                        s.SoundTableAmbienceVolume = volume;
                        _options.Update(s);
                    });
            }
            catch
            {
                // ignore
            }
            return Task.CompletedTask;
        }

        async Task<TableGameConfigWindow.Prompt?> PreloadStartConfigPromptAtTableOpenAsync(
            int roomId,
            string gameType,
            CancellationToken cancellationToken)
        {
            if (roomId <= 0 || string.IsNullOrWhiteSpace(gameType))
            {
                return null;
            }

            GameSession? probe = null;
            try
            {
                using var connectTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                connectTimeout.CancelAfter(GameTiming.Table.StartConfigPromptConnectTimeout);
                probe = await _games.ConnectAsync(roomId, gameType, connectTimeout.Token).ConfigureAwait(false);

                using var fetchTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                fetchTimeout.CancelAfter(GameTiming.Table.StartConfigPromptFetchTimeout);
                var prompt = await TryFetchPreStartConfigPromptAsync(probe, fetchTimeout.Token).ConfigureAwait(false);
                return prompt ?? BuildFallbackStartConfigPrompt(gameType);
            }
            catch
            {
                return BuildFallbackStartConfigPrompt(gameType);
            }
            finally
            {
                if (probe != null)
                {
                    try { await probe.DisposeAsync().ConfigureAwait(false); } catch { }
                }
            }
        }

        async Task<System.Collections.Generic.List<TableAmbiencePickerWindow.Choice>> BuildStartConfigAmbienceChoicesAsync(
            CancellationToken cancellationToken)
        {
            var result = new System.Collections.Generic.List<TableAmbiencePickerWindow.Choice>
            {
                new(string.Empty, "Silence (aucune ambiance)")
            };

            // Keep start-config dialog opening responsive: refresh remote sounds in background.
            _ = Task.Run(async () =>
            {
                try { await _remoteSounds.RefreshAsync(force: false).ConfigureAwait(false); } catch { }
            });

            Dictionary<string, string> labels;
            try { labels = await FetchTableAmbienceLabelsAsync(cancellationToken).ConfigureAwait(true); }
            catch { labels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); }

            if (labels.Count == 0)
            {
                return result;
            }

            foreach (var kv in labels.OrderBy(k => k.Value, StringComparer.OrdinalIgnoreCase))
            {
                var id = kv.Key;
                var name = kv.Value;
                var configured = Enum.TryParse<SoundId>(id, ignoreCase: true, out var sound) &&
                                 _remoteSounds.TryGetPath(sound) != null;
                result.Add(new TableAmbiencePickerWindow.Choice(
                    id,
                    configured ? name : $"{name} (non configurée)"));
            }

            return result;
        }

        await dispatcher.InvokeAsync(() =>
        {
            async Task Start()
            {
                if (session == null)
                {
                    return;
                }

                GameSession? preStartGameSession = null;
                var postStartConfigActionType = string.Empty;
                Dictionary<string, object>? postStartConfigPayload = null;
                var room = session.LastRoomState?.Room;
                var canStart = RoomAllowedActions.Contains(room, "room.start");
                var alreadyStarted = string.Equals(room?.Status, "started", StringComparison.OrdinalIgnoreCase) ||
                                    !string.IsNullOrWhiteSpace(room?.StartedAt);

                if (canStart && !alreadyStarted)
                {
                    try { bindings?.EnsurePreStartGameUiLoaded(); } catch { }

                    var current = (room?.TableAmbienceSoundId ?? string.Empty).Trim();
                    var choices = preloadedAmbienceChoicesTask != null
                        ? await preloadedAmbienceChoicesTask.ConfigureAwait(true)
                        : await BuildStartConfigAmbienceChoicesAsync(CancellationToken.None).ConfigureAwait(true);

                    TableGameConfigWindow.Prompt? cachedPrompt = null;
                    Task<TableGameConfigWindow.Prompt?>? prefetchPromptTask = null;
                    try
                    {
                        var gameType = (vm?.Game?.Id ?? placeholderGame.Id ?? string.Empty).Trim();
                        async Task<TableGameConfigWindow.Prompt?> PreloadPromptAsync()
                        {
                            try
                            {
                                if (cachedPrompt != null)
                                {
                                    return cachedPrompt;
                                }

                                if (string.IsNullOrWhiteSpace(gameType))
                                {
                                    return null;
                                }

                                if (preStartGameSession == null)
                                {
                                    using var connectTimeout = new CancellationTokenSource(GameTiming.Table.StartConfigPromptConnectTimeout);
                                    preStartGameSession = await _games.ConnectAsync(session.RoomId, gameType, connectTimeout.Token).ConfigureAwait(false);
                                }

                                using var fetchTimeout = new CancellationTokenSource(GameTiming.Table.StartConfigPromptFetchTimeout);
                                cachedPrompt = await TryFetchPreStartConfigPromptAsync(preStartGameSession, fetchTimeout.Token).ConfigureAwait(false)
                                    ?? BuildFallbackStartConfigPrompt(gameType);
                                return cachedPrompt;
                            }
                            catch
                            {
                                return BuildFallbackStartConfigPrompt(gameType);
                            }
                        }

                        async Task<TableGameConfigWindow.Prompt?> LoadPromptAsync()
                        {
                            if (cachedPrompt != null)
                            {
                                return cachedPrompt;
                            }

                            if (prefetchPromptTask != null)
                            {
                                var completed = await Task
                                    .WhenAny(prefetchPromptTask, Task.Delay(GameTiming.Table.StartConfigPromptSoftWait))
                                    .ConfigureAwait(false);
                                if (!ReferenceEquals(completed, prefetchPromptTask))
                                {
                                    // Keep interaction snappy: use fallback immediately if preload is still pending.
                                    return BuildFallbackStartConfigPrompt(gameType);
                                }

                                cachedPrompt = await prefetchPromptTask.ConfigureAwait(false);
                                if (cachedPrompt != null)
                                {
                                    return cachedPrompt;
                                }
                            }

                            if (string.IsNullOrWhiteSpace(gameType))
                            {
                                return null;
                            }

                            if (preStartGameSession == null)
                            {
                                using var connectTimeout = new CancellationTokenSource(GameTiming.Table.StartConfigPromptConnectTimeout);
                                preStartGameSession = await _games.ConnectAsync(session.RoomId, gameType, connectTimeout.Token).ConfigureAwait(false);
                            }

                            using var fetchTimeout = new CancellationTokenSource(GameTiming.Table.StartConfigPromptFetchTimeout);
                            cachedPrompt = await TryFetchPreStartConfigPromptAsync(preStartGameSession, fetchTimeout.Token).ConfigureAwait(false)
                                ?? BuildFallbackStartConfigPrompt(gameType);
                            return cachedPrompt;
                        }

                        // Priority:
                        // 1) preload started at table opening
                        // 2) local preload when opening the start-config dialog
                        if (preloadedStartConfigPromptTask != null &&
                            string.Equals(preloadedStartConfigPromptGameType, gameType, StringComparison.OrdinalIgnoreCase))
                        {
                            prefetchPromptTask = preloadedStartConfigPromptTask;
                        }
                        else
                        {
                            prefetchPromptTask = PreloadPromptAsync();
                        }

                        async Task<TableGameConfigWindow.Prompt?> LoadDialogPromptAsync()
                        {
                            return await LoadPromptAsync().ConfigureAwait(true);
                        }

                        if (cachedPrompt == null && prefetchPromptTask != null)
                        {
                            var completed = await Task
                                .WhenAny(prefetchPromptTask, Task.Delay(GameTiming.Table.StartConfigPromptSoftWait))
                                .ConfigureAwait(false);
                            if (ReferenceEquals(completed, prefetchPromptTask))
                            {
                                cachedPrompt = await prefetchPromptTask.ConfigureAwait(false);
                            }
                        }

                        var initialDialogPrompt = cachedPrompt;
                        var startFlow = await dispatcher
                            .InvokeAsync(
                                () => TableStartConfigWindow.PickStartFlow(
                                    owner: Application.Current?.MainWindow,
                                    currentSoundId: current,
                                    choices: choices,
                                    gameConfigPrompt: initialDialogPrompt,
                                    loadGameConfigPromptAsync: LoadDialogPromptAsync,
                                    soundService: _sounds),
                                DispatcherPriority.Normal)
                            .Task
                            .ConfigureAwait(true);

                        if (startFlow == null)
                        {
                            return;
                        }

                        // Apply ambience choice first (best-effort), then game config, then start.
                        try
                        {
                            await session.SendCommandAwaitAckAsync(
                                    "room.set-ambience",
                                    payload: new { soundId = startFlow.AmbienceSoundId })
                                .ConfigureAwait(true);
                        }
                        catch
                        {
                            // ignore (starting should still be possible)
                        }

                        if (!string.IsNullOrWhiteSpace(startFlow.GameConfigActionType))
                        {
                            if (preStartGameSession == null)
                            {
                                using var connectTimeout = new CancellationTokenSource(GameTiming.Table.StartConfigPromptConnectTimeout);
                                preStartGameSession = await _games.ConnectAsync(session.RoomId, gameType, connectTimeout.Token).ConfigureAwait(false);
                            }

                            var payload = startFlow.GameConfigPayload ?? new Dictionary<string, object>(StringComparer.Ordinal);
                            postStartConfigActionType = startFlow.GameConfigActionType;
                            postStartConfigPayload = new Dictionary<string, object>(payload, StringComparer.Ordinal);
                            await preStartGameSession.SendActionsAsync(
                                new[] { new GameClientAction(startFlow.GameConfigActionType, payload) },
                                CancellationToken.None).ConfigureAwait(false);
                        }
                    }
                    catch
                    {
                        // best-effort: room.start remains available even if pre-start config fails.
                    }
                }

                try
                {
                    try { bindings?.NotifyStartRequestedFromStartConfig(); } catch { }
                    await session.SendCommandAwaitAckAsync(
                            "room.start",
                            payload: null)
                        .ConfigureAwait(true);
                }
                finally
                {
                    if (preStartGameSession != null)
                    {
                        try { await preStartGameSession.DisposeAsync().ConfigureAwait(false); } catch { }
                        preStartGameSession = null;
                    }

                    // Do not block game UI startup on post-start config replay.
                    // Run it in background with its own short-lived game session.
                    if (!string.IsNullOrWhiteSpace(postStartConfigActionType) && postStartConfigPayload != null)
                    {
                        var gameType = (vm?.Game?.Id ?? placeholderGame.Id ?? string.Empty).Trim();
                        if (!string.IsNullOrWhiteSpace(gameType))
                        {
                            _ = Task.Run(async () =>
                            {
                                GameSession? replaySession = null;
                                try
                                {
                                    using var connectTimeout = new CancellationTokenSource(GameTiming.Table.PostStartReplayConnectTimeout);
                                    replaySession = await _games.ConnectAsync(session.RoomId, gameType, connectTimeout.Token).ConfigureAwait(false);

                                    await replaySession.SendActionsAsync(
                                            new[] { new GameClientAction(postStartConfigActionType, postStartConfigPayload) },
                                            CancellationToken.None)
                                        .ConfigureAwait(false);
                                }
                                catch
                                {
                                    // best-effort
                                }
                                finally
                                {
                                    if (replaySession != null)
                                    {
                                        try { await replaySession.DisposeAsync().ConfigureAwait(false); } catch { }
                                    }
                                }
                            });
                        }
                    }
                }
            }

            startHandler = Start;
            async Task Reset()
            {
                if (session == null)
                {
                    return;
                }

                await session.SendCommandAwaitAckAsync(
                        "room.reset",
                        payload: null)
                    .ConfigureAwait(true);
            }
            Task SendChat(string message) =>
                session?.SendCommandAsync("room.chat.send", payload: new { message }) ?? Task.CompletedTask;

            async Task ShowRules()
            {
                if (session == null)
                {
                    try { await _dialogs.ShowInfo("Règles", "Connexion à la table...").ConfigureAwait(true); } catch { }
                    return;
                }

                GameSession? gameSession = null;
                string? errorDetail = null;
                try
                {
                    var gameType = (vm?.Game?.Id ?? placeholderGame.Id ?? string.Empty).Trim();
                    var gameName = (vm?.Game?.Name ?? placeholderGame.Name ?? string.Empty).Trim();
                    if (string.IsNullOrWhiteSpace(gameType))
                    {
                        throw new InvalidOperationException("Type de jeu introuvable.");
                    }

                    using var timeout = new CancellationTokenSource(GameTiming.Table.RulesConnectTimeout);
                    gameSession = await _games.ConnectAsync(session.RoomId, gameType, timeout.Token)
                        .ConfigureAwait(false);

                    var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
                    void OnRules(GameRulesPayloadDto dto)
                    {
                        if (!string.Equals(dto.GameType, gameType, StringComparison.OrdinalIgnoreCase))
                        {
                            return;
                        }
                        tcs.TrySetResult(dto.Rules ?? string.Empty);
                    }

                    void OnError(string message)
                    {
                        if (string.IsNullOrWhiteSpace(message))
                        {
                            return;
                        }
                        errorDetail = message.Trim();
                    }

                    gameSession.ErrorReceived += OnError;
                    gameSession.RulesReceived += OnRules;
                    try
                    {
                        await gameSession.RequestRulesAsync(timeout.Token).ConfigureAwait(false);
                        var completed = await Task.WhenAny(tcs.Task, Task.Delay(GameTiming.Table.RulesResponseTimeout, timeout.Token))
                            .ConfigureAwait(false);
                        if (completed != tcs.Task)
                        {
                            throw new TimeoutException("Règles : délai dépassé.");
                        }

                        var rules = await tcs.Task.ConfigureAwait(false);
                        await dispatcher.InvokeAsync(() =>
                        {
                            GameRulesWindow.Show(
                                owner: Application.Current?.MainWindow,
                                title: $"Règles - {gameName}",
                                rules: rules);
                        }, DispatcherPriority.Normal).Task.ConfigureAwait(false);
                    }
                    finally
                    {
                        gameSession.RulesReceived -= OnRules;
                        gameSession.ErrorReceived -= OnError;
                    }
                }
                catch (Exception ex)
                {
                    var detail = string.IsNullOrWhiteSpace(errorDetail) ? ex.Message : errorDetail;
                    try { await _dialogs.ShowInfo("Règles", $"Impossible de charger les règles.\nDétail: {detail}").ConfigureAwait(true); } catch { }
                }
                finally
                {
                    if (gameSession != null)
                    {
                        try { await gameSession.DisposeAsync().ConfigureAwait(false); } catch { }
                    }
                }
            }

            Func<Task> _ignoreShowRules = ShowRules;

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
                onShowRules: ShowRulesAsync,
                onConfigureTableAmbience: ConfigureTableAmbienceAsync,
                onConfigureTableAmbienceVolume: ConfigureTableAmbienceVolumeAsync,
                onStart: Start,
                onSaveSnapshot: SaveSnapshot,
                onReset: Reset,
                onQuit: QuitRoom,
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
                focusCoordinator: _focus,
                screenReader: _screenReader,
                announcements: _announcementService);
            vm.Status = "Connexion à la table...";
            vm.IsReconnecting = true;
            vm.GameZone.IsConnected = false;
            vm.Chat.IsConnected = false;

            _navigation.Show(vm);
        }, DispatcherPriority.Normal);

        _ = Task.Run(async () =>
        {
            try
            {
                // Start ambience choices preload immediately (independent from room connection).
                if (preloadedAmbienceChoicesTask == null)
                {
                    preloadedAmbienceChoicesTask = BuildStartConfigAmbienceChoicesAsync(cts.Token);
                }

                var connected = await connect(cts.Token).ConfigureAwait(false);
                if (cts.IsCancellationRequested)
                {
                    try { await connected.DisposeAsync().ConfigureAwait(false); } catch { }
                    return;
                }

                session = connected;
                var game = buildGameFromSession(session);
                // Start config preloads as early as possible to reduce "first Enter" latency.
                TryStartConfigPreloads(session, game);

                // Audio warm-up (best-effort): évite les latences (premier dé, bonne/mauvaise réponse, ambiance de table).
                // Ne bloque pas l'ouverture de la table.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        if (Interlocked.Exchange(ref _globalSoundsPreloaded, 1) == 0)
                        {
                            try { _sounds.PreloadAll(); } catch { }
                        }

                        try { await _audio.RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, cancellationToken: cts.Token).ConfigureAwait(false); } catch { }

                        var rawAmbience = (session?.LastRoomState?.Room?.TableAmbienceSoundId ?? string.Empty).Trim();
                        if (!string.IsNullOrWhiteSpace(rawAmbience) &&
                            Enum.TryParse<SoundId>(rawAmbience, ignoreCase: true, out var ambienceSound))
                        {
                            try { _sounds.Preload(ambienceSound); } catch { }
                        }
                    }
                    catch
                    {
                        // ignore
                    }
                });

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
                            async Task StartFromFallbackAsync()
                            {
                                await session.SendCommandAwaitAckAsync(
                                        "room.start",
                                        payload: null)
                                    .ConfigureAwait(true);
                            }

                            var start = startHandler ?? StartFromFallbackAsync;
	                        var newVm = new GameRoomViewModel(
	                            game,
                            onSendChat: msg => session.SendCommandAsync("room.chat.send", payload: new { message = msg }),
                            onShowRules: ShowRulesAsync,
                            onConfigureTableAmbience: ConfigureTableAmbienceAsync,
                            onConfigureTableAmbienceVolume: ConfigureTableAmbienceVolumeAsync,
                            onStart: start,
                            onSaveSnapshot: SaveSnapshot,
                            onReset: async () =>
                            {
                                await session.SendCommandAwaitAckAsync(
                                        "room.reset",
                                        payload: null)
                                    .ConfigureAwait(true);
                            },
                            onQuit: QuitRoom,
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
	                            focusCoordinator: _focus,
	                            screenReader: _screenReader,
	                            announcements: _announcementService);
	                        newVm.Status = "Connexion à la table...";
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

                    // Preload start-config data as soon as the table opens (owner + not started).
                    // This runs before the user presses Enter/Suivant.
                    if (preloadedStartConfigPromptTask == null || preloadedAmbienceChoicesTask == null)
                    {
                        TryStartConfigPreloads(session, vm.Game);
                    }

                    var createdMessage = isNew
                        ? $"Table de {game.Name} créée. Ajoutez des bots et commencez à jouer."
                        : $"Table rejointe : {game.Name}.";
                    new GameHistorySink(dispatcher, vm.History, _announcementService).Add(createdMessage);

                    var openSound = isNew ? SoundId.RoomOpened : SoundId.RoomJoined;

                    if (Volatile.Read(ref playedEarlyOpenSound) == 0)
                    {
                        // UX: prioritize immediate feedback. Play the open/join one-shot first, then warm up other sounds.
                        try
                        {
                            _sounds.Preload(openSound, warmUp: true);
                        }
                        catch
                        {
                            // best-effort
                        }

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                // Allow warm-up to enqueue first but don't delay feedback too much.
                                await Task.Delay(GameTiming.Table.OpenSoundDelay).ConfigureAwait(false);
                            }
                            catch
                            {
                                // ignore
                            }

                            try { _sounds.Play(openSound); } catch { }
                        });
                    }

                    // Preload table + common gameplay one-shots early (async/background) so first actions feel snappy.
                    try
                    {
                        _sounds.Preload(SoundId.RoomOpened, warmUp: true);
                        _sounds.Preload(SoundId.RoomJoined, warmUp: true);
                        _sounds.Preload(SoundId.DiceRolled, warmUp: true);
                        _sounds.Preload(SoundId.DrawCard, warmUp: true);
                        _sounds.Preload(SoundId.QuizCorrect, warmUp: true);
                        _sounds.Preload(SoundId.QuizWrong, warmUp: true);
                        _sounds.Preload(SoundId.RoundEnded, warmUp: true);
                        _sounds.Preload(SoundId.PawnPicked, warmUp: true);
                        _sounds.Preload(SoundId.PawnPlacedSelf, warmUp: true);
                        _sounds.Preload(SoundId.PawnPlacedOpponent, warmUp: true);
                        _sounds.Preload(SoundId.WallPlacedSelf, warmUp: true);
                        _sounds.Preload(SoundId.WallPlacedOpponent, warmUp: true);
                    }
                    catch
                    {
                        // best-effort
                    }

                    var soundsToWarm = new[]
                    {
                        SoundId.DiceRolled,
                        SoundId.DrawCard,
                        SoundId.QuizCorrect,
                        SoundId.QuizWrong,
                        SoundId.RoundEnded,
                        SoundId.PawnPicked,
                        SoundId.PawnPlacedSelf,
                        SoundId.PawnPlacedOpponent,
                        SoundId.WallPlacedSelf,
                        SoundId.WallPlacedOpponent,
                    };

                    foreach (var sound in soundsToWarm)
                    {
                        _ = _sounds.WarmUpAsync(sound);
                    }

                    var room = new RoomClient(session, _announcements);
                    bindings = new GameTableBindings(
                        dispatcher: dispatcher,
                        game: game,
                        tableVm: vm,
                        announcements: _announcements,
                        room: room,
                        sounds: _sounds,
                        options: _options,
                        announcementService: _announcementService,
                        createGamePlayVm: () => CreateGamePlayViewModel(session, game),
                        selfUsername: _navigation.CurrentUser?.Username ?? string.Empty);
                    bindings.Attach();
                    bindings.InitializeFromLastState();

                    // Précharge les sons de jeu dès l'ouverture de la table pour éviter la latence
                    // (MediaOpened / cache distant) lors du premier déclenchement.
                    try
                    {
                        // Already preloaded above (best-effort).
                    }
                    catch
                    {
                        // best-effort
                    }

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
                            _ = ExitAsync(message.Trim(), forceTavern: true);
                        }
                    };

                    onSessionLeft = type =>
                    {
                          if (string.Equals(type, "room.deleted", StringComparison.OrdinalIgnoreCase))
                          {
                              _ = ExitAsync(null, forceTavern: true);
                          }
                        else
                        {
                            // room.left: quitter (ou être éjecté) doit toujours ramener à la taverne.
                            _ = ExitAsync("Vous avez quitté la table.", forceTavern: true);
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
                            vm.Status = "Connexion à la table...";
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

    private GamePlayViewModel CreateGamePlayViewModel(IRoomSession room, CatalogGame game)
    {
        return new GamePlayViewModel(
            gameId: game.Id,
            connect: ct => _games.ConnectAsync(room.RoomId, game.Id, ct),
            dialogs: _dialogs,
            textPrompts: _textPrompts,
            sounds: _sounds);
    }

    private static async Task<GameStateDto> RequestGameStateAsync(GameSession session, CancellationToken cancellationToken)
    {
        var tcs = new TaskCompletionSource<GameStateDto>(TaskCreationOptions.RunContinuationsAsynchronously);
        void OnState(GameStateDto s) => tcs.TrySetResult(s);
        session.StateUpdated += OnState;
        try
        {
            await session.RequestStateAsync(cancellationToken).ConfigureAwait(false);
            var completed = await Task.WhenAny(tcs.Task, Task.Delay(GameTiming.Table.PromptMaxTimeout, cancellationToken))
                .ConfigureAwait(false);
            if (completed == tcs.Task)
            {
                return await tcs.Task.ConfigureAwait(false);
            }
        }
        finally
        {
            session.StateUpdated -= OnState;
        }

        return session.LastState ?? new GameStateDto();
    }

    private static async Task<TableGameConfigWindow.Prompt?> TryFetchPreStartConfigPromptAsync(
        GameSession session,
        CancellationToken cancellationToken)
    {
        return await WaitForConfigPromptAsync(
                session,
                expectedActionType: null,
                timeout: GameTiming.Table.PromptFastTimeout,
                cancellationToken)
            .ConfigureAwait(false);
    }

    private static async Task<bool> WaitForConfigPromptReadyAsync(
        GameSession session,
        string expectedActionType,
        CancellationToken cancellationToken)
    {
        var prompt = await WaitForConfigPromptAsync(
                session,
                expectedActionType,
                timeout: GameTiming.Table.PromptSlowTimeout,
                cancellationToken)
            .ConfigureAwait(false);
        return prompt != null;
    }

    private static async Task<TableGameConfigWindow.Prompt?> WaitForConfigPromptAsync(
        GameSession session,
        string? expectedActionType,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        var expected = (expectedActionType ?? string.Empty).Trim();

        TableGameConfigWindow.Prompt? TryMatchPrompt(GameStateDto? state)
        {
            if (!TryExtractConfigPrompt(state, out var prompt) || prompt == null)
            {
                return null;
            }

            if (string.IsNullOrWhiteSpace(expected) ||
                string.Equals(prompt.ActionType, expected, StringComparison.OrdinalIgnoreCase))
            {
                return prompt;
            }

            return null;
        }

        // Fast path on last known state.
        var immediate = TryMatchPrompt(session.LastState);
        if (immediate != null)
        {
            return immediate;
        }

        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linked.CancelAfter(timeout);

        var tcs = new TaskCompletionSource<TableGameConfigWindow.Prompt?>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        void OnState(GameStateDto s)
        {
            var matched = TryMatchPrompt(s);
            if (matched != null)
            {
                tcs.TrySetResult(matched);
            }
        }

        session.StateUpdated += OnState;
        try
        {
            try { await session.RequestStateAsync(linked.Token).ConfigureAwait(false); } catch { }

            var matchedAfterRequest = TryMatchPrompt(session.LastState);
            if (matchedAfterRequest != null)
            {
                return matchedAfterRequest;
            }

            var completed = await Task.WhenAny(tcs.Task, Task.Delay(timeout, linked.Token)).ConfigureAwait(false);
            if (completed == tcs.Task)
            {
                return await tcs.Task.ConfigureAwait(false);
            }

            return null;
        }
        finally
        {
            session.StateUpdated -= OnState;
        }
    }

    private static bool TryExtractConfigPrompt(GameStateDto? state, out TableGameConfigWindow.Prompt? prompt)
    {
        prompt = null;
        static string? GetString(JsonElement obj, string prop) =>
            obj.TryGetProperty(prop, out var el) && el.ValueKind == JsonValueKind.String
                ? el.GetString()
                : null;

        static int? GetInt(JsonElement obj, string prop)
        {
            if (!obj.TryGetProperty(prop, out var el)) return null;
            if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var i)) return i;
            if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), out var s)) return s;
            return null;
        }

        static JsonElement? GetArray(JsonElement obj, string prop)
        {
            if (!obj.TryGetProperty(prop, out var el)) return null;
            return el.ValueKind == JsonValueKind.Array ? el : null;
        }

        static JsonElement? GetObject(JsonElement obj, string prop)
        {
            if (!obj.TryGetProperty(prop, out var el)) return null;
            return el.ValueKind == JsonValueKind.Object ? el : null;
        }

        static TableGameConfigWindow.Prompt? BuildPromptFromObject(JsonElement data)
        {
            var actionType = (GetString(data, "actionType") ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(actionType))
            {
                return null;
            }

            var fieldsEl = GetArray(data, "fields")
                ?? GetArray(data, "configFields")
                ?? (GetObject(data, "config") is { } cfg ? GetArray(cfg, "fields") : null);
            if (fieldsEl == null || fieldsEl.Value.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var fields = new List<TableGameConfigWindow.Field>();
            foreach (var field in fieldsEl.Value.EnumerateArray())
            {
                if (field.ValueKind != JsonValueKind.Object) continue;
                var key = (GetString(field, "key") ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(key)) continue;
                var min = GetInt(field, "min") ?? GetInt(field, "minValue");
                var max = GetInt(field, "max") ?? GetInt(field, "maxValue");
                fields.Add(new TableGameConfigWindow.Field(
                    Key: key,
                    Label: (GetString(field, "label") ?? key).Trim(),
                    Kind: (GetString(field, "kind") ?? "text").Trim(),
                    Min: min,
                    Max: max,
                    InitialText: GetString(field, "initialText") ?? string.Empty));
            }

            if (fields.Count == 0)
            {
                return null;
            }

            return new TableGameConfigWindow.Prompt(
                Title: (GetString(data, "title") ?? "Configuration du jeu").Trim(),
                ActionType: actionType,
                CancelActionType: (GetString(data, "cancelActionType") ?? string.Empty).Trim(),
                Fields: fields);
        }

        var pending = state?.Pending;
        if (pending != null &&
            string.Equals((pending.Type ?? string.Empty).Trim(), "config_prompt", StringComparison.OrdinalIgnoreCase) &&
            pending.Data.ValueKind == JsonValueKind.Object)
        {
            prompt = BuildPromptFromObject(pending.Data);
            if (prompt != null)
            {
                return true;
            }
        }

        // Fallback: certains jeux exposent le prompt dans metadata.prompt avant le pending public.
        if (state?.Metadata.ValueKind == JsonValueKind.Object &&
            GetObject(state.Metadata, "prompt") is { } promptObj &&
            string.Equals((GetString(promptObj, "type") ?? string.Empty).Trim(), "config_prompt", StringComparison.OrdinalIgnoreCase))
        {
            prompt = BuildPromptFromObject(promptObj);
            if (prompt != null)
            {
                return true;
            }
        }

        return false;
    }

    private static TableGameConfigWindow.Prompt? BuildFallbackStartConfigPrompt(string? gameType)
    {
        var normalized = (gameType ?? string.Empty).Trim().ToLowerInvariant();
        if (string.Equals(normalized, "arche-de-mnemosyne", StringComparison.Ordinal) ||
            string.Equals(normalized, "arche-de-nemosyne", StringComparison.Ordinal))
        {
            return new TableGameConfigWindow.Prompt(
                Title: "Configuration - Arche de Mnemosyne",
                ActionType: "mnemo_set_config",
                CancelActionType: "mnemo_prompt_cancel",
                Fields: new[]
                {
                    new TableGameConfigWindow.Field("correctSoloPoints", "Points si un seul joueur répond correctement", "number", null, null, "2"),
                    new TableGameConfigWindow.Field("correctMultiPoints", "Points par joueur en cas de bonnes réponses multiples", "number", null, null, "1"),
                    new TableGameConfigWindow.Field("wrongPoints", "Points appliqués en cas de mauvaise réponse", "number", null, null, "0"),
                    new TableGameConfigWindow.Field("timeoutPoints", "Points appliqués sans réponse (timeout)", "number", null, null, "-1"),
                    new TableGameConfigWindow.Field("targetPoints", "Score cible pour gagner", "number", null, null, "20"),
                    new TableGameConfigWindow.Field("useTimer", "Activer le chrono par question", "boolean", null, null, "oui"),
                    new TableGameConfigWindow.Field("timerSeconds", "Durée du chrono par question (secondes)", "number", null, null, "30"),
                    new TableGameConfigWindow.Field("interQuestionSeconds", "Pause entre les questions (secondes)", "number", null, null, "15"),
                });
        }

        if (string.Equals(normalized, "cat-pattes", StringComparison.Ordinal))
        {
            return new TableGameConfigWindow.Prompt(
                Title: "Cat Pattes !",
                ActionType: "cat_pattes_set_config",
                CancelActionType: null,
                Fields: new[]
                {
                    new TableGameConfigWindow.Field("goalPattes", "Objectif pattes", "number", 600, 1500, "1000"),
                    new TableGameConfigWindow.Field("pointsToWin", "Points pour gagner", "number", 1000, 20000, "4000"),
                });
        }

        if (!string.Equals(normalized, "lama", StringComparison.Ordinal))
        {
            return null;
        }

        return new TableGameConfigWindow.Prompt(
            Title: "LAMA",
            ActionType: "lama_set_config",
            CancelActionType: null,
            Fields: new[]
            {
                new TableGameConfigWindow.Field("loseAtScore", "Score de défaite (jetons)", "number", 5, 200, "40"),
                new TableGameConfigWindow.Field("roundPauseSeconds", "Pause entre manches (secondes)", "number", 0, 120, "2"),
                new TableGameConfigWindow.Field("allowPlayAfterDraw", "Autoriser de rejouer après une pioche", "boolean", null, null, "non"),
                new TableGameConfigWindow.Field("allowDrawAfterFirstQuit", "Autoriser la pioche après qu'un joueur s'est retiré (dans la manche)", "boolean", null, null, "non"),
                new TableGameConfigWindow.Field("returnTokenFromRound", "Manche à partir de laquelle un jeton peut être rendu", "number", 1, 50, "2"),
            });
    }

    private Task AnnouncePlayersAsync(IRoomSession session)
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
