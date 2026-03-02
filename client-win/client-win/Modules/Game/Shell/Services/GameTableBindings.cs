using System;
using System.ComponentModel;
using System.Collections.Specialized;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using Serilog;
using client_win.Core.Input;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.Play.GamePlay.ViewModels;
using client_win.Modules.Game.Room.Input;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.Models;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Game.Play.GamePlay.Dtos;

namespace client_win.Modules.Game.Shell.Services;

internal sealed class GameTableBindings : IAsyncDisposable
{
    private readonly Dispatcher _dispatcher;
    private readonly CatalogGame _game;
    private readonly IRoomFacade _room;
    private readonly GameRoomViewModel _tableVm;
    private readonly IRoomAnnouncements _announcements;
    private readonly IGameHistorySink _history;
    private readonly RoomIntentDispatcher _intentDispatcher;
    private readonly ISoundService _sounds;
    private readonly IOptionsService? _options;
    private readonly IAnnouncementService? _announcementService;
    private readonly string _selfUsername;
    private readonly GameTableLifecycleCoordinator _lifecycle;


    private readonly Func<GamePlayViewModel> _createGamePlayVm;
    private GamePlayViewModel? _gamePlayVm;
    private NotifyCollectionChangedEventHandler? _onGameplayShortcutsChanged;

    private Action<RoomPayloadDto>? _onRoomUpdated;
    private Action<RoomAnnouncement>? _onAnnounced;
    private Action<string>? _onSessionError;
    private Action<GamePlayHistoryMessage>? _onGameMessage;
    private Action<string, string>? _onGameStatusChanged;
    private Action<bool>? _onStartReadyChanged;
    private Action<IReadOnlyList<RoomChatMessageDto>>? _onChatHistory;
    private Action<RoomChatMessageDto>? _onChatMessage;
    private Action<JsonElement>? _onIntentReceived;
    private Action<bool>? _onRoleChangedHandler;
    private bool _roomStopConfirmationPending;

    private bool _lastRoomStarted;
    private Dictionary<int, (string Username, bool Spectator)> _participants = new();
    private int _ownerId = 0;
    private bool _selfIsSpectator;
    private Modules.Audio.Models.SoundId? _activeTableAmbienceSound;
    private readonly HashSet<long> _seenChatSeq = new();
    private bool _ignoreChatHistoryOnce = true;

    public GameTableBindings(
        Dispatcher dispatcher,
        CatalogGame game,
        GameRoomViewModel tableVm,
        IRoomAnnouncements announcements,
        IRoomFacade room,
        ISoundService sounds,
        IOptionsService? options,
        IAnnouncementService? announcementService,
        Func<GamePlayViewModel> createGamePlayVm,
        string selfUsername)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _game = game ?? throw new ArgumentNullException(nameof(game));
        _tableVm = tableVm ?? throw new ArgumentNullException(nameof(tableVm));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        _room = room ?? throw new ArgumentNullException(nameof(room));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _options = options;
        _announcementService = announcementService;
        _createGamePlayVm = createGamePlayVm ?? throw new ArgumentNullException(nameof(createGamePlayVm));
        _selfUsername = (selfUsername ?? string.Empty).Trim();
        _history = new GameHistorySink(_dispatcher, _tableVm.History, _announcementService);
        _intentDispatcher = new RoomIntentDispatcher(_tableVm, _history, _announcements);
        _lifecycle = new GameTableLifecycleCoordinator(
            dispatcher: _dispatcher,
            requestFocus: reason => _tableVm.GameZone.RequestFocus(reason),
            isGameplayStartReady: IsGameplayStartReadyFromLastState,
            requestTurnAnnouncementAsync: RequestTurnAnnouncementAsync,
            log: (state, source, version) =>
            {
                Log.Debug("StartFlow -> {State} ({Source}) [v={Version}]", state, source, version);
            });
    }

    public Task AddBotAsync()
    {
        _announcementService?.NotifyUserInteraction();
        return _room.AddBotAsync();
    }

    public Task RemoveBotAsync()
    {
        _announcementService?.NotifyUserInteraction();
        return _room.RemoveBotAsync();
    }
    public Task TogglePrivacyAsync() => _room.TogglePrivacyAsync();
    public Task ToggleRoleAsync() => _room.ToggleRoleAsync();
    public Task RequestInfoAsync()
    {
        _announcementService?.NotifyUserInteraction();
        return _room.RequestInfoAsync();
    }
    public void EnsurePreStartGameUiLoaded() => EnsureGamePlayLoaded();

    private static bool IsRoomStarted(RoomDto? room)
    {
        if (room == null)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(room.StartedAt))
        {
            return true;
        }

        return string.Equals(room.Status, "started", StringComparison.OrdinalIgnoreCase);
    }

    public void Attach()
    {
        try { _announcementService?.SetGameplayUltraReactive(true); } catch { }
        var last = _room.CurrentPayload;
        _lastRoomStarted = IsRoomStarted(last?.Room);
        _lifecycle.InitializeState(_lastRoomStarted);
        _roomStopConfirmationPending = false;
        SeedParticipants(last?.Room);
        _selfIsSpectator = ComputeSelfSpectator();
        UpdateStartEligibility(last);
        SyncChatEnabled(last?.Manifest);

        // Local echo: ensures the sender hears/sees their own chat immediately.
        // The server echo will be consumed via ConsumePendingEcho to avoid duplicates.
        _tableVm.Chat.LocalEcho = text =>
        {
	            try
	            {
	                _sounds.Play(SoundId.TableChatMessageSent);
	            }
	            catch
	            {
	                // ignore
	            }

            var user = string.IsNullOrWhiteSpace(_selfUsername) ? "Vous" : _selfUsername.Trim();
	            var message = (text ?? string.Empty).Trim();
	            if (string.IsNullOrWhiteSpace(message))
	            {
	                _history.AddChat($"Chat — {user} :");
	            }
	            else
	            {
	                _history.AddChat($"Chat — {user} : {message}");
	            }
	        };

        _onAnnounced = announcement =>
        {
            if (announcement == null || string.IsNullOrWhiteSpace(announcement.Message)) return;
            _history.Add(announcement.Message);
        };
        _announcements.Announced += _onAnnounced;

        _room.InfoReceived += message =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                try { _announcements.TableInfo(message); } catch { }
            }, DispatcherPriority.Background);
        };

        _onIntentReceived = payload => _intentDispatcher.HandleIntent(payload);
        _room.IntentReceived += _onIntentReceived;

        _onSessionError = message =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                try { _announcements.Error(message); } catch { }
            }, DispatcherPriority.Background);
        };
        _room.ErrorReceived += _onSessionError;

        _onChatHistory = messages =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                try
                {
                    if (_ignoreChatHistoryOnce)
                    {
                        _ignoreChatHistoryOnce = false;
                        return;
                    }

                    if (messages == null) return;

                    foreach (var msg in messages)
                    {
                        if (msg == null) continue;
                        if (msg.Seq > 0 && _seenChatSeq.Contains(msg.Seq)) continue;
                        if (msg.Seq > 0) _seenChatSeq.Add(msg.Seq);
                        if (ShouldConsumeLocalEcho(msg))
                        {
                            continue;
                        }
                        _history.AddChat(FormatChatLine(msg));
                    }
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Erreur lors du traitement de l'historique du tchat");
                }
            }, DispatcherPriority.Background);
        };
        _room.ChatHistoryReceived += _onChatHistory;

        _onChatMessage = msg =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                try
                {
                    if (msg == null) return;
                    if (msg.Seq > 0 && _seenChatSeq.Contains(msg.Seq)) return;
                    if (msg.Seq > 0) _seenChatSeq.Add(msg.Seq);
                    if (ShouldConsumeLocalEcho(msg))
                    {
                        return;
                    }

                    MaybePlayChatSound(msg);
                    _history.AddChat(FormatChatLine(msg));
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Erreur lors du traitement d'un message de tchat");
                }
            }, DispatcherPriority.Background);
        };
        _room.ChatMessageReceived += _onChatMessage;

        // IMPORTANT:
        // Les ajouts/retraits de bots sont déjà reflétés par `room.updated`.
        // On laisse TrackBots() gérer l'annonce pour éviter les doublons dans l'historique.

        _onRoleChangedHandler = isSpectator =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                    try
                    {
                        _selfIsSpectator = isSpectator;
                        ApplySpectatorState();
                    }
                catch (Exception ex)
                {
                    Log.Error(ex, "Erreur lors du changement de rôle");
                }
            }, DispatcherPriority.Background);
        };
        _room.RoleChanged += _onRoleChangedHandler;

        _onRoomUpdated = payload =>
        {
            _ = _dispatcher.InvokeAsync(async () =>
            {
                try
                {
                    UpdateGameTitle(payload);
                    SyncChatEnabled(payload.Manifest);
                    TrackParticipants(payload.Room);
                    _ownerId = payload.Room?.Owner?.Id ?? 0;
                    ApplySpectatorState();
                    UpdateStartEligibility(payload);

                    var wasStarted = _lastRoomStarted;
                    var nowStarted = IsRoomStarted(payload.Room);
                    _lastRoomStarted = nowStarted;
                    if (nowStarted)
                    {
                        _roomStopConfirmationPending = false;
                    }

                    // Keep table ambience loop in sync with room settings (start/stop/change).
                    SyncTableAmbience(payload, started: nowStarted);

                    // Rebuild room shortcuts on every room.updated, even without a started/setup transition.
                    // This keeps shortcut availability aligned with server-provided allowedActions.
                    if (wasStarted == nowStarted)
                    {
                        SetRoomShortcutsForStarted(started: nowStarted);
                        if (nowStarted)
                        {
                            SyncGameplayShortcuts();
                        }
                    }

                    if (!wasStarted && nowStarted)
                    {
                        EnterStartedFlow(source: "room.updated", fromGameStatus: false, announceIfFirst: true);
                        return;
                    }

                    if (wasStarted && !nowStarted)
                    {
                        ResetStartFlow(source: "room.updated.stop");
                        if (ShouldConfirmRoomStopTransition())
                        {
                            return;
                        }

                        // Stop table ambience when leaving the game.
                        SyncTableAmbience(payload, started: false);

                        SetRoomShortcutsForStarted(started: false);

                        // Best-effort: ask an explicit refresh before unloading.
                        try
                        {
                            _ = _room.RequestStateRefreshAsync(force: true);
                        }
                        catch
                        {
                            // best-effort
                        }

                        if (IsRoomStarted(_room.CurrentPayload?.Room))
                        {
                            return;
                        }

                        if (_tableVm.GameZone.Content != null || _gamePlayVm != null)
                        {
                            FocusParking.Park();
                            _tableVm.GameZone.Content = null;
                            await UnloadGamePlayVmAsync().ConfigureAwait(true);
                        }

                        var gameName = (payload.Manifest?.Name ?? _game.Name ?? string.Empty).Trim();
                        // Forcer le focus sur la zone de jeu (le contenu a été déchargé).
                        _ = _dispatcher.BeginInvoke(
                            DispatcherPriority.ApplicationIdle,
                            new Action(() => _tableVm.GameZone.RequestFocus(GameFocusReason.AfterDialog)));
                    }
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Erreur lors du traitement de room.updated sur l'UI");
                }
            }, DispatcherPriority.Background);
        };
        _room.RoomUpdated += _onRoomUpdated;

        if (_options != null)
        {
            _options.Changed += OnOptionsChanged;
        }
    }

    private bool ShouldConfirmRoomStopTransition()
    {
        var gameUiWasActive = _tableVm.GameZone.IsStarted || _gamePlayVm != null || _tableVm.GameZone.Content != null;
        if (!gameUiWasActive)
        {
            _roomStopConfirmationPending = false;
            return false;
        }

        if (_roomStopConfirmationPending)
        {
            _roomStopConfirmationPending = false;
            return false;
        }

        _roomStopConfirmationPending = true;
        try
        {
            _ = _room.RequestStateRefreshAsync(force: true);
        }
        catch
        {
            // best-effort
        }
        return true;
    }

    private void OnOptionsChanged(object? sender, EventArgs e)
    {
        _ = _dispatcher.InvokeAsync(() =>
        {
            try
            {
                var last = _room.CurrentPayload;
                if (last != null)
                {
                    var isStarted = _lastRoomStarted;
                    SyncTableAmbience(last, started: isStarted);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Erreur lors du changement d'options");
            }
        }, DispatcherPriority.Background);
    }

    public void InitializeFromLastState()
    {
        try
        {
            var last = _room.CurrentPayload;
            if (last != null)
            {
                UpdateGameTitle(last);
                SyncChatEnabled(last.Manifest);
            }

            var isStarted = IsRoomStarted(last?.Room);
            _lastRoomStarted = isStarted;
            _lifecycle.InitializeState(isStarted);
            SetRoomShortcutsForStarted(isStarted);
            if (isStarted)
            {
                EnsureGamePlayLoaded();
                SyncGameplayShortcuts();
            }

            if (last != null)
            {
                SyncTableAmbience(last, started: isStarted);
            }
            UpdateStartEligibility(last);

            // room.created may occasionally arrive before the first room.updated.
            // If allowedActions are missing in the initial payload, request a fresh state.
            if ((last?.Room?.AllowedActions?.Count ?? 0) == 0)
            {
                _ = _room.RequestStateRefreshAsync(force: true);
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de l'initialisation des bindings à partir du dernier état");
        }
    }

    private void SyncTableAmbience(RoomPayloadDto payload, bool started)
    {
        try
        {
            if (!started)
            {
                if (_activeTableAmbienceSound.HasValue)
                {
                    _sounds.StopLoop(_activeTableAmbienceSound.Value);
                    _activeTableAmbienceSound = null;
                }
                return;
            }

            var raw = (payload?.Room?.TableAmbienceSoundId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(raw))
            {
                if (_activeTableAmbienceSound.HasValue)
                {
                    _sounds.StopLoop(_activeTableAmbienceSound.Value);
                    _activeTableAmbienceSound = null;
                }
                return;
            }

            if (!Enum.TryParse<SoundId>(raw, ignoreCase: true, out var sound))
            {
                return;
            }

            if (_activeTableAmbienceSound.HasValue && _activeTableAmbienceSound.Value == sound)
            {
                // If the sound is already active, but it might have been stopped by SoundService (options change),
                // we should check if it needs to be restarted.
                // However, StartLoop handles already running loops.
                // The real issue is if it was STOPPED and now needs to RESTART.
                _sounds.StartLoop(sound);
                return;
            }

            if (_activeTableAmbienceSound.HasValue)
            {
                _sounds.StopLoop(_activeTableAmbienceSound.Value);
                _activeTableAmbienceSound = null;
            }

            _sounds.Preload(sound);
            _sounds.StartLoop(sound);
            _activeTableAmbienceSound = sound;
        }
        catch
        {
            // best-effort
        }
    }

    private void SeedParticipants(RoomDto? room)
    {
        _participants = BuildParticipants(room);
        _ownerId = room?.Owner?.Id ?? 0;
    }

    private void TrackParticipants(RoomDto? room)
    {
        if (room == null) return;
        var next = BuildParticipants(room);

        foreach (var (id, info) in next)
        {
            if (_participants.ContainsKey(id))
            {
                continue;
            }

            // Son quand un joueur rejoint la table.
            _sounds.Play(SoundId.RoomJoined);
        }

        foreach (var (id, info) in _participants)
        {
            if (next.ContainsKey(id))
            {
                continue;
            }

            try { _sounds.Play(SoundId.RoomExit); } catch { }
        }

        _participants = next;
    }

    private static Dictionary<int, (string Username, bool Spectator)> BuildParticipants(RoomDto? room)
    {
        var output = new Dictionary<int, (string Username, bool Spectator)>();
        if (room == null)
        {
            return output;
        }

        foreach (var p in room.Players ?? new List<RoomUserDto>())
        {
            if (p == null || p.Id <= 0) continue;
            var name = (p.Username ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            output[p.Id] = (name, Spectator: false);
        }

        foreach (var s in room.Spectators ?? new List<RoomUserDto>())
        {
            if (s == null || s.Id <= 0) continue;
            var name = (s.Username ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            output[s.Id] = (name, Spectator: true);
        }

        return output;
    }

    private static bool IsGameplayShortcut(ShortcutDefinition shortcut)
    {
        var code = shortcut.Code;
        if (string.IsNullOrWhiteSpace(code))
        {
            return false;
        }

        return code.StartsWith("game.", StringComparison.OrdinalIgnoreCase) ||
               code.StartsWith("ui.", StringComparison.OrdinalIgnoreCase) ||
               code.StartsWith("server.key.", StringComparison.OrdinalIgnoreCase);
    }

    private void EnterStartedFlow(string source, bool fromGameStatus, bool announceIfFirst)
    {
        SetRoomShortcutsForStarted(started: true);
        EnsureGamePlayLoaded();
        SyncGameplayShortcuts();

        var result = _lifecycle.NotifyStarted(source, fromGameStatus);
        if (announceIfFirst && result.IsFirstStartTransition)
        {
            try { _sounds.Play(SoundId.TableStarted); } catch { }
        }
    }

    private void ResetStartFlow(string source) => _lifecycle.Reset(source);

    public void NotifyStartRequestedFromWizard() => _lifecycle.NotifyWizardStartRequested();

    private bool IsGameplayStartReadyFromLastState()
    {
        try
        {
            var state = _gamePlayVm?.Session?.LastState;
            if (state == null || !string.Equals(state.Status, "started", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var metadata = state.Metadata;
            if (metadata.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (!metadata.TryGetProperty("lifecycle", out var lifecycle) ||
                lifecycle.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (!lifecycle.TryGetProperty("startReady", out var ready))
            {
                return false;
            }

            return ready.ValueKind == System.Text.Json.JsonValueKind.True;
        }
        catch
        {
            return false;
        }
    }

    private void SetRoomShortcutsForStarted(bool started)
    {
        _tableVm.GameZone.IsStarted = started;
        UpdateStartEligibility(_room.CurrentPayload);
        _tableVm.GameZone.Shortcuts.Clear();

        var allowedShortcutCodes = RoomAllowedActions.ToShortcutCodeSet(_room.CurrentPayload?.Room);

        var shortcuts = RoomShortcuts.Create(
            rulesCommand: _tableVm.GameZone.RulesCommand,
            tableAmbienceCommand: _tableVm.GameZone.ConfigureTableAmbienceCommand,
            tableAmbienceVolumeCommand: _tableVm.GameZone.ConfigureTableAmbienceVolumeCommand,
            saveSnapshotCommand: _tableVm.GameZone.SaveSnapshotCommand,
            resetCommand: _tableVm.GameZone.ResetCommand,
            addBotCommand: _tableVm.GameZone.AddBotCommand,
            removeBotCommand: _tableVm.GameZone.RemoveBotCommand,
            announcePlayersCommand: _tableVm.GameZone.AnnouncePlayersCommand,
            announceInfoCommand: _tableVm.GameZone.AnnounceInfoCommand,
            togglePrivacyCommand: _tableVm.GameZone.TogglePrivacyCommand,
            toggleRoleCommand: _tableVm.GameZone.ToggleRoleCommand,
            inviteCommand: _tableVm.GameZone.InviteCommand,
            kickCommand: _tableVm.GameZone.KickCommand,
            banCommand: _tableVm.GameZone.BanCommand,
            transferOwnerCommand: _tableVm.GameZone.TransferOwnerCommand,
            quitCommand: _tableVm.GameZone.QuitCommand);

        foreach (var shortcut in started ? shortcuts.Where(s => s.AvailableInGame) : shortcuts)
        {
            // Source de verite: permissions serveur uniquement.
            if (string.IsNullOrWhiteSpace(shortcut.Code) || !allowedShortcutCodes.Contains(shortcut.Code))
            {
                continue;
            }

            _tableVm.GameZone.Shortcuts.Add(shortcut);
        }
    }

    private void RemoveGameplayShortcuts()
    {
        for (var i = _tableVm.GameZone.Shortcuts.Count - 1; i >= 0; i--)
        {
            var shortcut = _tableVm.GameZone.Shortcuts[i];
            if (IsGameplayShortcut(shortcut))
            {
                _tableVm.GameZone.Shortcuts.RemoveAt(i);
            }
        }
    }

	    private void SyncGameplayShortcuts()
	    {
            try
            {
                RemoveGameplayShortcuts();

                if (_gamePlayVm == null)
                {
                    return;
                }

                if (_selfIsSpectator)
                {
                    return;
                }

                // Les raccourcis "game./ui." (dont server.key.*) ne doivent être actifs
                // que pendant une partie. Sinon ils interceptent des touches de "table"
                // (ex: 'b' pour ajouter un bot) après une fin de partie.
                if (!_tableVm.GameZone.IsStarted)
                {
                    return;
                }

                foreach (var shortcut in _gamePlayVm.Shortcuts.Where(IsGameplayShortcut))
                {
                    _tableVm.GameZone.Shortcuts.Add(shortcut);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Erreur lors de la synchronisation des raccourcis de jeu");
            }
	    }

		    private void EnsureGamePlayLoaded()
		    {
		        EnsureGamePlayVmCreated();

		        _tableVm.GameZone.Content = _gamePlayVm;
		        ApplySpectatorState();
		    }

        private async Task RequestTurnAnnouncementAsync()
        {
            try
            {
                EnsureGamePlayLoaded();
                if (_gamePlayVm == null)
                {
                    return;
                }

                // Ensure the game session is ready before issuing explicit state/turn requests.
                // Otherwise, early requests right after room.start can be dropped silently.
                await _gamePlayVm.InitializeAsync(CancellationToken.None).ConfigureAwait(true);

                var vm = _gamePlayVm;
                if (vm == null)
                {
                    return;
                }

                await vm.RequestTurnInfoAsync().ConfigureAwait(true);

                // Keep state refresh best-effort and non-blocking so turn announcement stays reactive.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _dispatcher.InvokeAsync(
                            async () => await vm.RequestStateInfoAsync().ConfigureAwait(true),
                            DispatcherPriority.Background);
                    }
                    catch
                    {
                        // best-effort
                    }
                });
            }
            catch (Exception ex)
            {
                Log.Debug(ex, "Impossible de récupérer le tour courant après démarrage de table");
            }
        }

        private void EnsureGamePlayVmCreated()
        {
            if (_gamePlayVm != null)
            {
                return;
            }

            _gamePlayVm = _createGamePlayVm();
            if (_gamePlayVm == null)
            {
                return;
            }

            _onGameMessage = msg => _history.Add(msg.Message, msg.Timestamp);
            _gamePlayVm.MessageReceived += _onGameMessage;

            _onGameStatusChanged = (previousStatus, nextStatus) =>
                _ = _dispatcher.InvokeAsync(async () =>
                {
                    try
                    {
                        await HandleGameStatusChangedAsync(previousStatus, nextStatus).ConfigureAwait(true);
                    }
                    catch (Exception ex)
                    {
                        Log.Error(ex, "Erreur lors du changement de statut du jeu (handled)");
                    }
                }, DispatcherPriority.Background);
            _gamePlayVm.GameStatusChanged += _onGameStatusChanged;

            _onStartReadyChanged = ready =>
            {
                if (!ready)
                {
                    return;
                }

                _lifecycle.NotifyStartReady();
            };
            _gamePlayVm.StartReadyChanged += _onStartReadyChanged;

            if (_gamePlayVm.Shortcuts is INotifyCollectionChanged notify)
            {
                _onGameplayShortcutsChanged = (_, __) =>
                    _dispatcher.InvokeAsync(SyncGameplayShortcuts, DispatcherPriority.Background);
                notify.CollectionChanged += _onGameplayShortcutsChanged;
            }
        }

    private async System.Threading.Tasks.Task HandleGameStatusChangedAsync(string previousStatus, string nextStatus)
    {
        var nowStarted = string.Equals(nextStatus, "started", StringComparison.OrdinalIgnoreCase);

        // Synchronisation idempotente (evite les races room.status vs game.status) :
        // on garantit que (IsStarted, Content, raccourcis) correspondent au statut du jeu.
        var hasGamePlayLoaded = _tableVm.GameZone.Content != null || _gamePlayVm != null;

        if (nowStarted)
        {
            EnterStartedFlow(source: "game.status", fromGameStatus: true, announceIfFirst: true);
            return;
        }

        ResetStartFlow(source: "game.status.stop");

        // Fin de partie : le serveur remet la table en "setup" (reset systeme).
        // En cas de race/deconnexion courte, forcer un refresh explicite de l'etat de table
        // pour reactiver ajout/retrait de bots et relance via Entree.
        try
        {
            _ = _room.RequestStateRefreshAsync(force: true);
        }
        catch
        {
            // best-effort
        }

        // Le jeu n'est plus en "started" : on doit pouvoir relancer via Entree (room.start),
        // donc on decharge la zone de jeu et on refocus l'ancre.
        if (_tableVm.GameZone.IsStarted)
        {
            SetRoomShortcutsForStarted(started: false);
        }
        else
        {
            // Meme si IsStarted est deja faux (ex: room.updated recu avant),
            // on force un resync des raccourcis pour eviter un etat incoherent.
            SetRoomShortcutsForStarted(started: false);
        }

        if (hasGamePlayLoaded)
        {
            // IMPORTANT (NVDA):
            // Si le controle actuellement focuse (dans la zone de jeu) disparait, NVDA annonce souvent "indisponible".
            // On park donc le focus sur un element stable avant de decharger le contenu.
            FocusParking.Park();

            _tableVm.GameZone.Content = null;
            await UnloadGamePlayVmAsync().ConfigureAwait(true);
        }

        // Le contenu a ete decharge, refocus sur l'ancre pour permettre Entree (room.start).
        _ = _dispatcher.BeginInvoke(
            DispatcherPriority.ApplicationIdle,
            new Action(() => _tableVm.GameZone.RequestFocus(GameFocusReason.AfterDialog)));
    }

    private async System.Threading.Tasks.Task UnloadGamePlayVmAsync()
	    {
		        if (_gamePlayVm == null)
		        {
		            return;
		        }

		        if (_onGameMessage != null)
		        {
		            _gamePlayVm.MessageReceived -= _onGameMessage;
		            _onGameMessage = null;
		        }
		        if (_onGameStatusChanged != null)
		        {
		            _gamePlayVm.GameStatusChanged -= _onGameStatusChanged;
		            _onGameStatusChanged = null;
		        }
                if (_onStartReadyChanged != null)
                {
                    _gamePlayVm.StartReadyChanged -= _onStartReadyChanged;
                    _onStartReadyChanged = null;
                }
		        if (_onGameplayShortcutsChanged != null &&
		            _gamePlayVm.Shortcuts is System.Collections.Specialized.INotifyCollectionChanged notify)
		        {
		            notify.CollectionChanged -= _onGameplayShortcutsChanged;
		            _onGameplayShortcutsChanged = null;
		        }

	        await _gamePlayVm.DisposeAsync().ConfigureAwait(true);
	        _gamePlayVm = null;
	    }

    private void ApplySpectatorState()
    {
        _selfIsSpectator = ComputeSelfSpectator();
        UpdateStartEligibility(_room.CurrentPayload);
        _gamePlayVm?.SetSpectator(_selfIsSpectator);
        SyncGameplayShortcuts();
    }

    private void UpdateStartEligibility(RoomPayloadDto? payload)
    {
        try
        {
            var room = payload?.Room ?? _room.CurrentPayload?.Room;
            if (room == null)
            {
                _tableVm.GameZone.CanStart = false;
                return;
            }

            // Source de vérité: l'autorisation serveur.
            // Aucun fallback local (owner/spectator/minPlayers) pour éviter les décisions côté client.
            _tableVm.GameZone.CanStart = RoomAllowedActions.Contains(room, "room.start");
        }
        catch
        {
            _tableVm.GameZone.CanStart = false;
        }
    }

    private bool ComputeSelfSpectator()
    {
        if (string.IsNullOrWhiteSpace(_selfUsername))
        {
            return _room.IsSpectator;
        }

        var self = (_selfUsername ?? string.Empty).Trim();
        foreach (var entry in _participants.Values)
        {
            if (!string.Equals((entry.Username ?? string.Empty).Trim(), self, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return entry.Spectator;
        }

        // Fallback: état local (reçu via room.role) si la room ne nous expose pas dans le roster.
        return _room.IsSpectator;
    }

    private int TryGetSelfParticipantId()
    {
        if (string.IsNullOrWhiteSpace(_selfUsername))
        {
            return 0;
        }

        var self = (_selfUsername ?? string.Empty).Trim();
        foreach (var (id, entry) in _participants)
        {
            if (!string.Equals((entry.Username ?? string.Empty).Trim(), self, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return id;
        }

        return 0;
    }

    private void UpdateGameTitle(RoomPayloadDto? payload)
    {
        if (payload == null) return;
        var name = payload.Manifest?.Name;
        if (string.IsNullOrWhiteSpace(name)) return;

        var title = name.Trim();
        _ = _dispatcher.InvokeAsync(() =>
        {
            try
            {
                if (_tableVm?.GameZone != null)
                {
                    _tableVm.GameZone.Title = title;
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Erreur lors de la mise à jour du titre du jeu");
            }
        }, DispatcherPriority.Background);
    }

    private void SyncChatEnabled(GameManifestDto? manifest)
    {
        if (manifest == null)
        {
            return;
        }

        var chatEnabled = manifest.ChatEnabled;
        var soundsEnabled = manifest.ChatSoundsEnabled;

        _ = _dispatcher.InvokeAsync(() =>
        {
            try
            {
                if (_tableVm?.Chat != null)
                {
                    _tableVm.Chat.IsEnabled = chatEnabled;
                    _tableVm.Chat.IsSoundsEnabled = soundsEnabled;
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Erreur lors de la synchronisation de l'état du tchat");
            }
        }, DispatcherPriority.Background);
    }

    private bool ShouldConsumeLocalEcho(RoomChatMessageDto msg)
    {
        if (msg == null) return false;
        if (string.IsNullOrWhiteSpace(_selfUsername)) return false;
        if (!string.Equals((_selfUsername ?? string.Empty).Trim(), (msg.Username ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var consumed = _tableVm.Chat.ConsumePendingEcho(msg.Message);
        if (consumed)
        {
            // L'écho local a déjà ajouté la ligne + son d'envoi.
            return true;
        }
        return false;
    }

	    private void MaybePlayChatSound(RoomChatMessageDto msg)
	    {
	        if (_tableVm.Chat.IsSoundsEnabled != true)
	        {
	            return;
	        }

	        var fromSelf =
	            !string.IsNullOrWhiteSpace(_selfUsername) &&
	            string.Equals((_selfUsername ?? string.Empty).Trim(), (msg.Username ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase);

	        _sounds.Play(fromSelf ? SoundId.TableChatMessageSent : SoundId.TableChatMessageReceived);
	    }

    private static string FormatChatLine(RoomChatMessageDto msg)
	    {
	        var user = (msg.Username ?? string.Empty).Trim();
	        var text = (msg.Message ?? string.Empty).Trim();
	        if (string.IsNullOrWhiteSpace(user)) user = "Utilisateur";
	        // Le tchat doit rester sur une seule ligne dans l'historique (NVDA + lisibilité).
	        text = text.Replace("\r\n", " ").Replace('\r', ' ').Replace('\n', ' ');
	        if (string.IsNullOrWhiteSpace(text)) return $"Chat — {user} :";
	        return $"Chat — {user} : {text}";
	    }

		    public async ValueTask DisposeAsync()
		    {
		        try
		        {
            _tableVm.Chat.LocalEcho = null;
            if (_onAnnounced != null)
            {
                _announcements.Announced -= _onAnnounced;
                _onAnnounced = null;
            }
            if (_options != null)
            {
                _options.Changed -= OnOptionsChanged;
            }
            if (_onRoomUpdated != null)
            {
                _room.RoomUpdated -= _onRoomUpdated;
                _onRoomUpdated = null;
            }
            if (_onSessionError != null)
            {
                _room.ErrorReceived -= _onSessionError;
                _onSessionError = null;
            }
            if (_onChatHistory != null)
            {
                _room.ChatHistoryReceived -= _onChatHistory;
                _onChatHistory = null;
            }
            if (_onChatMessage != null)
            {
                _room.ChatMessageReceived -= _onChatMessage;
                _onChatMessage = null;
            }
            if (_onIntentReceived != null)
            {
                _room.IntentReceived -= _onIntentReceived;
                _onIntentReceived = null;
            }
            if (_onRoleChangedHandler != null)
            {
                _room.RoleChanged -= _onRoleChangedHandler;
                _onRoleChangedHandler = null;
            }

            if (_gamePlayVm != null)
            {
                await UnloadGamePlayVmAsync().ConfigureAwait(true);
            }

            await _room.LeaveAsync().ConfigureAwait(true);
            await _room.DisposeAsync().ConfigureAwait(true);

            if (_activeTableAmbienceSound.HasValue)
            {
                try { _sounds.StopLoop(_activeTableAmbienceSound.Value); } catch { }
                _activeTableAmbienceSound = null;
            }
        }
        catch
        {
            // Best-effort; le backend ferme la table quand la derniére connexion sort.
        }
        finally
        {
            try { _announcementService?.SetGameplayUltraReactive(false); } catch { }
        }
    }
}

