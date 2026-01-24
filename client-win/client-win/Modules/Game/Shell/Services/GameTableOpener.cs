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
using client_win.Modules.Config;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.Play.GamePlay.ViewModels;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Social.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.User.Services;
using client_win.Modules.TextPrompts.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Game.RoomDirectory.ViewModels;
using client_win.Modules.Vault.Services;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Catalog.ViewModels;
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
    private readonly IRoomDirectoryClient _directory;
    private readonly ISocialService _social;
    private readonly ITextPromptService _textPrompts;
    private readonly IVaultClient _vault;
    private readonly ICatalogService _catalog;
    private static int _globalSoundsPreloaded;

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
        IRoomDirectoryClient directory,
        ISocialService social,
        ITextPromptService textPrompts,
        IVaultClient vault,
        ICatalogService catalog)
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
    }

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

        await OpenDeferredAsync(
                placeholderGame: game,
                returnContent: returnContent,
                connect: ct => _rooms.CreateAndConnectAsync(game.Id, ct),
                buildGameFromSession: _ => game,
                isNew: true,
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

    private static IReadOnlyList<RosterEntry> BuildRoster(RoomSession session)
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
            await session.SendCommandAsync("bot.remove", payload: new { botId = target.Id })
                .ConfigureAwait(true);
            return;
        }

        await session.SendCommandAsync(ban ? "room.ban" : "room.kick", payload: new { userId = target.Id })
            .ConfigureAwait(true);
    }

    private async Task TransferOwnerAsync(RoomSession session)
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

        await session.SendCommandAsync("room.set-owner", payload: new { userId = target.Id }).ConfigureAwait(true);
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
                vaultSnapshotId: vaultSnapshotId)
            .ConfigureAwait(true);
    }

    private async Task OpenDeferredAsync(
        CatalogGame placeholderGame,
        object returnContent,
        Func<CancellationToken, Task<RoomSession>> connect,
        Func<RoomSession, CatalogGame> buildGameFromSession,
        bool isNew,
        string? vaultSnapshotId)
    {
        var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        var cts = new CancellationTokenSource();
        RoomSession? session = null;
        GameTableBindings? bindings = null;
        Action<client_win.Modules.Network.WebSockets.WebSocketState>? onRoomConnectionStateChanged = null;
        Action<string>? onSessionLeft = null;
        var isExiting = 0;

        async Task ExitAsync(string? reason = null, bool forceTavern = false)
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

                object BuildTavernFallback()
                {
                    var safeReturn = returnContent is GameRoomViewModel ? null : returnContent;

                    CatalogViewModel? catalogVm = null;
                    catalogVm = new CatalogViewModel(
                        _catalog,
                        onClose: () =>
                        {
                            try { catalogVm?.Dispose(); } catch { /* ignore */ }
                            if (safeReturn != null)
                            {
                                try { _navigation.Show(safeReturn); } catch { /* ignore */ }
                            }
                        },
                        openGame: async game =>
                        {
                            if (catalogVm == null) return;
                            await OpenAsync(game, catalogVm).ConfigureAwait(true);
                        },
                        joinGame: async () =>
                        {
                            if (catalogVm == null) return "Impossible d'ouvrir Rejoindre une table.";

                            JoinGameViewModel? tavernVm = null;
                            tavernVm = new JoinGameViewModel(
                                rooms: _directory,
                                tables: this,
                                announcements: _announcementService,
                                returnContent: () => catalogVm,
                                onClose: () =>
                                {
                                    try { tavernVm?.Dispose(); } catch { /* ignore */ }
                                    try { _navigation.Show(catalogVm); } catch { /* ignore */ }
                                });
                            _navigation.Show(tavernVm);
                            return "Rejoindre une table ouvert.";
                        },
                        openVault: async () =>
                        {
                            if (catalogVm == null) return "Impossible d'ouvrir Mon coffre fort.";

                            VaultViewModel? vaultVm = null;
                            vaultVm = new VaultViewModel(
                                _vault,
                                this,
                                _dialogs,
                                _announcementService,
                                returnContent: catalogVm,
                                onClose: () =>
                                {
                                    try { vaultVm?.Dispose(); } catch { /* ignore */ }
                                    try { _navigation.Show(catalogVm); } catch { /* ignore */ }
                                });

                            _navigation.Show(vaultVm);
                            return "Mon coffre fort ouvert.";
                        });

                    return catalogVm;
                }

                void Navigate()
                {
                    try
                    {
                        if (forceTavern)
                        {
                            // Après une sauvegarde (Ctrl+S) : revenir à la racine de la taverne (étagères)
                            // quand on vient du catalogue, plutôt que d'atterrir sur "Rejoindre une table".
                            if (returnContent is client_win.Modules.Catalog.ViewModels.CatalogViewModel)
                            {
                                _navigation.Show(returnContent);
                            }
                            else
                            {
                                _navigation.Show(BuildTavernFallback());
                            }
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
                        // Fallback de sÃ©curitÃ© : si le retour vers l'Ã©cran prÃ©cÃ©dent est impossible,
                        // ouvrir la liste des tables publiques plutÃ´t que de laisser un "Ã©cran vide".
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
                _announcementService.Enqueue(
                    "Table sauvegardée dans Mon coffre fort. Retour à la taverne.",
                    AnnouncementPriority.Polite);
                _ = ExitAsync(null, forceTavern: true);
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

            await ExitAsync(forceTavern: isRestoredFromVault).ConfigureAwait(true);
        }

        GameRoomViewModel? vm = null;
        Func<Task>? startHandler = null;

        async Task ShowRulesAsync()
        {
            if (session == null)
            {
                try { await _dialogs.ShowInfo("Règles", "Connexion à la table…").ConfigureAwait(true); } catch { }
                return;
            }

            GameSession? gameSession = null;
            try
            {
                var gameType = (vm?.Game?.Id ?? placeholderGame.Id ?? string.Empty).Trim();
                var gameName = (vm?.Game?.Name ?? placeholderGame.Name ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(gameType))
                {
                    throw new InvalidOperationException("Type de jeu introuvable.");
                }

                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
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

                gameSession.RulesReceived += OnRules;
                try
                {
                    await gameSession.RequestRulesAsync(timeout.Token).ConfigureAwait(false);
                    var completed = await Task.WhenAny(tcs.Task, Task.Delay(TimeSpan.FromSeconds(5), timeout.Token))
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
                            title: $"Règles — {gameName}",
                            rules: rules);
                    }, DispatcherPriority.Normal).Task.ConfigureAwait(false);
                }
                finally
                {
                    gameSession.RulesReceived -= OnRules;
                }
            }
            catch
            {
                try { await _dialogs.ShowInfo("Règles", "Impossible de charger les règles.").ConfigureAwait(true); } catch { }
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
                try { await _dialogs.ShowInfo("Ambiance", "Connexion à la table…").ConfigureAwait(true); } catch { }
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
                choices: choices);

            if (selected == null)
            {
                return;
            }

            try
            {
                // Convention: empty string clears the ambience (silence).
                await session.SendCommandAsync("room.set-ambience", payload: new { soundId = selected })
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

        await dispatcher.InvokeAsync(() =>
        {
            async Task Start()
            {
                if (session == null)
                {
                    return;
                }

                var room = session.LastRoomState?.Room;
                var selfId = _sessionService.CurrentUser?.UserId ?? 0;
                var isOwner = selfId > 0 && room?.Owner?.Id == selfId;
                var alreadyStarted = string.Equals(room?.Status, "started", StringComparison.OrdinalIgnoreCase) ||
                                    !string.IsNullOrWhiteSpace(room?.StartedAt);

                if (isOwner && !alreadyStarted)
                {
                    try { await _remoteSounds.RefreshAsync(force: false).ConfigureAwait(true); } catch { }

                    var current = (room?.TableAmbienceSoundId ?? string.Empty).Trim();
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

                    var selected = TableStartConfigWindow.Pick(
                        owner: Application.Current?.MainWindow,
                        currentSoundId: current,
                        choices: choices);

                    if (selected == null)
                    {
                        return;
                    }

                    // Apply ambience choice first (best-effort), then start the room.
                    try
                    {
                        await session.SendCommandAsync("room.set-ambience", payload: new { soundId = selected })
                            .ConfigureAwait(true);
                    }
                    catch
                    {
                        // ignore (starting should still be possible)
                    }
                }

                await session.SendCommandAsync("room.start", payload: null).ConfigureAwait(true);
            }

            startHandler = Start;
            Task Reset() => session?.SendCommandAsync("room.reset", payload: null) ?? Task.CompletedTask;
            Task SendChat(string message) =>
                session?.SendCommandAsync("room.chat.send", payload: new { message }) ?? Task.CompletedTask;

            async Task ShowRules()
            {
                if (session == null)
                {
                    try { await _dialogs.ShowInfo("Règles", "Connexion à la table…").ConfigureAwait(true); } catch { }
                    return;
                }

                GameSession? gameSession = null;
                try
                {
                    var gameType = (vm?.Game?.Id ?? placeholderGame.Id ?? string.Empty).Trim();
                    var gameName = (vm?.Game?.Name ?? placeholderGame.Name ?? string.Empty).Trim();
                    if (string.IsNullOrWhiteSpace(gameType))
                    {
                        throw new InvalidOperationException("Type de jeu introuvable.");
                    }

                    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
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

                    gameSession.RulesReceived += OnRules;
                    try
                    {
                        await gameSession.RequestRulesAsync(timeout.Token).ConfigureAwait(false);
                        var completed = await Task.WhenAny(tcs.Task, Task.Delay(TimeSpan.FromSeconds(5), timeout.Token))
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
                                title: $"Règles — {gameName}",
                                rules: rules);
                        }, DispatcherPriority.Normal).Task.ConfigureAwait(false);
                    }
                    finally
                    {
                        gameSession.RulesReceived -= OnRules;
                    }
                }
                catch
                {
                    try { await _dialogs.ShowInfo("Règles", "Impossible de charger les règles.").ConfigureAwait(true); } catch { }
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

                        try { await _remoteSounds.RefreshAsync(force: false).ConfigureAwait(false); } catch { }

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
                            var start = startHandler ?? (() => session.SendCommandAsync("room.start", payload: null));
	                        var newVm = new GameRoomViewModel(
	                            game,
                            onSendChat: msg => session.SendCommandAsync("room.chat.send", payload: new { message = msg }),
                            onShowRules: ShowRulesAsync,
                            onConfigureTableAmbience: ConfigureTableAmbienceAsync,
                            onConfigureTableAmbienceVolume: ConfigureTableAmbienceVolumeAsync,
                            onStart: start,
                            onSaveSnapshot: SaveSnapshot,
                            onReset: () => session.SendCommandAsync("room.reset", payload: null),
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

                    // Preload table + common gameplay one-shots early (async/background) so first actions feel snappy.
                    try
                    {
                        _sounds.Preload(SoundId.RoomOpened);
                        _sounds.Preload(SoundId.RoomJoined);
                        _sounds.Preload(SoundId.DiceRolled);
                        _sounds.Preload(SoundId.QuizCorrect);
                        _sounds.Preload(SoundId.QuizWrong);
                        _sounds.Preload(SoundId.RoundEnded);
                        _sounds.Preload(SoundId.PawnPicked);
                        _sounds.Preload(SoundId.PawnPlacedSelf);
                        _sounds.Preload(SoundId.PawnPlacedOpponent);
                        _sounds.Preload(SoundId.WallPlacedSelf);
                        _sounds.Preload(SoundId.WallPlacedOpponent);
                    }
                    catch
                    {
                        // best-effort
                    }

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
                            _ = ExitAsync("Table fermée.", forceTavern: true);
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
