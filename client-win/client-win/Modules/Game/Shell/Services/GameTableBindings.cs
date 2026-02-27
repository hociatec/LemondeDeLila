using System;
using System.ComponentModel;
using System.Collections.Specialized;
using System.Collections.Generic;
using System.Linq;
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
    private readonly RoomSession _session;
    private readonly GameRoomViewModel _tableVm;
    private readonly IRoomAnnouncements _announcements;
    private readonly IGameHistorySink _history;
    private readonly ISoundService _sounds;
    private readonly IOptionsService? _options;
    private readonly IAnnouncementService? _announcementService;
    private readonly string _selfUsername;

    private readonly RoomBotCommands _bots;
    private readonly RoomPrivacyCommands _privacy;
    private readonly RoomRoleCommands _role;
    private readonly RoomInfoCommands _info;
    private readonly RoomChatCommands _chat;

    private readonly Func<GamePlayViewModel> _createGamePlayVm;
    private GamePlayViewModel? _gamePlayVm;
    private NotifyCollectionChangedEventHandler? _onGameplayShortcutsChanged;

	    private Action<RoomPayloadDto>? _onRoomUpdated;
	    private Action<RoomAnnouncement>? _onAnnounced;
	    private Action<string>? _onSessionError;
    private Action<GamePlayHistoryMessage>? _onGameMessage;
	    private Action<string, string>? _onGameStatusChanged;
    private bool _roomStopConfirmationPending;
    private CancellationTokenSource? _roomStopGraceCts;
    private static readonly TimeSpan RoomStopGraceDelay = TimeSpan.FromMilliseconds(650);

    private bool _lastRoomStarted;
    private Dictionary<int, (string Username, bool Spectator)> _participants = new();
    private Dictionary<int, string> _botsById = new();
    private int _ownerId = 0;
    private bool _selfIsSpectator;
    private Modules.Audio.Models.SoundId? _activeTableAmbienceSound;
    private readonly HashSet<long> _seenChatSeq = new();
    private bool _ignoreChatHistoryOnce = true;

    public GameTableBindings(
        Dispatcher dispatcher,
        CatalogGame game,
        RoomSession session,
        GameRoomViewModel tableVm,
        IRoomAnnouncements announcements,
        ISoundService sounds,
        IOptionsService? options,
        IAnnouncementService? announcementService,
        Func<GamePlayViewModel> createGamePlayVm,
        string selfUsername)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _game = game ?? throw new ArgumentNullException(nameof(game));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _tableVm = tableVm ?? throw new ArgumentNullException(nameof(tableVm));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _options = options;
        _announcementService = announcementService;
        _createGamePlayVm = createGamePlayVm ?? throw new ArgumentNullException(nameof(createGamePlayVm));
        _selfUsername = (selfUsername ?? string.Empty).Trim();
        _history = new GameHistorySink(_dispatcher, _tableVm.History, _announcementService);

        _bots = new RoomBotCommands(_session);
        _privacy = new RoomPrivacyCommands(_session);
        _role = new RoomRoleCommands(_session);
        _info = new RoomInfoCommands(_session);
        _chat = new RoomChatCommands(_session);
    }

    public Task AddBotAsync() => _bots.AddBotAsync();
    public Task RemoveBotAsync() => _bots.RemoveLastBotAsync();
    public Task TogglePrivacyAsync() => _privacy.TogglePrivacyAsync();
    public Task ToggleRoleAsync() => _role.ToggleRoleAsync(ComputeSelfSpectator());
    public Task RequestInfoAsync() => _info.RequestInfoAsync();
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
        var last = _session.LastRoomState;
        _lastRoomStarted = IsRoomStarted(last?.Room);
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

        _info.InfoReceived += message =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                try { _announcements.TableInfo(message); } catch { }
            }, DispatcherPriority.Background);
        };

        _onSessionError = message =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                try { _announcements.Error(message); } catch { }
            }, DispatcherPriority.Background);
        };
        _session.ErrorReceived += _onSessionError;

        _chat.HistoryReceived += messages =>
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

        _chat.MessageReceived += msg =>
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

        // IMPORTANT:
        // Les ajouts/retraits de bots sont déjà reflétés par `room.updated`.
        // On laisse TrackBots() gérer l'annonce pour éviter les doublons dans l'historique.

        _privacy.PrivacyChanged += isPrivate =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                try
                {
                    // L'annonce passe via IRoomAnnouncements -> Announced -> historique (puis SR).
                    // Ne pas dupliquer via _history.Add / Status (sinon double lecture).
                    _announcements.VisibilityChanged(isPrivate);
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Erreur lors du changement de confidentialité");
                }
            }, DispatcherPriority.Background);
        };

        _role.RoleChanged += isSpectator =>
        {
            _ = _dispatcher.InvokeAsync(() =>
            {
                try
                {
                    // L'annonce passe via IRoomAnnouncements -> Announced -> historique (puis SR).
                    // Ne pas dupliquer via _history.Add / Status (sinon double lecture).
                    _announcements.RoleChanged(isSpectator);
                    _selfIsSpectator = isSpectator;
                    ApplySpectatorState();
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Erreur lors du changement de rôle");
                }
            }, DispatcherPriority.Background);
        };

        _onRoomUpdated = payload =>
        {
            _ = _dispatcher.InvokeAsync(async () =>
            {
                try
                {
                    UpdateGameTitle(payload);
                    SyncChatEnabled(payload.Manifest);
                    TrackParticipants(payload.Room);
                    TrackBots(payload.Room);
                    TrackOwner(payload.Room);
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

                    if (!wasStarted && nowStarted)
                    {
                        CancelRoomStopGraceDelay();
                        SetRoomShortcutsForStarted(started: true);
                        EnsureGamePlayLoaded();
                        SyncGameplayShortcuts();

                        _announcements.TableInfo("Table démarrée.");
                        try { _sounds.Play(SoundId.TableStarted); } catch { }
                        _ = RequestTurnAnnouncementAsync();

                        // Forcer le focus sur la zone de jeu.
                        _ = _dispatcher.BeginInvoke(
                            DispatcherPriority.ApplicationIdle,
                            new Action(() => _tableVm.GameZone.RequestFocus(GameFocusReason.TableStarted)));
                        return;
                    }

                    if (wasStarted && !nowStarted)
                    {
                        if (ShouldConfirmRoomStopTransition())
                        {
                            return;
                        }

                        // Stop table ambience when leaving the game.
                        SyncTableAmbience(payload, started: false);

                        SetRoomShortcutsForStarted(started: false);
                        CancelRoomStopGraceDelay();
                        var stopCts = new CancellationTokenSource();
                        _roomStopGraceCts = stopCts;

                        // Best-effort: ask an explicit refresh, then keep a short grace period so
                        // gameplay can consume late end-state events before unloading the zone.
                        try
                        {
                            _ = _session.RequestStateRefreshAsync(force: true);
                        }
                        catch
                        {
                            // best-effort
                        }

                        try
                        {
                            await Task.Delay(RoomStopGraceDelay, stopCts.Token).ConfigureAwait(true);
                        }
                        catch (OperationCanceledException)
                        {
                            return;
                        }

                        if (!ReferenceEquals(_roomStopGraceCts, stopCts))
                        {
                            return;
                        }

                        if (IsRoomStarted(_session.LastRoomState?.Room))
                        {
                            return;
                        }

                        _tableVm.GameZone.Content = null;
                        await UnloadGamePlayVmAsync().ConfigureAwait(true);

                        var gameName = (payload.Manifest?.Name ?? _game.Name ?? string.Empty).Trim();
                        if (string.IsNullOrWhiteSpace(gameName))
                        {
                            _announcements.TableInfo("Table créée. Ajoutez des bots et commencez à jouer (Entrée).");
                        }
                        else
                        {
                            _announcements.TableInfo($"Table de {gameName} créée. Ajoutez des bots et commencez à jouer (Entrée).");
                        }

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
	        _session.RoomUpdated += _onRoomUpdated;

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
            _ = _session.RequestStateRefreshAsync(force: true);
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
                var last = _session.LastRoomState;
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
            var last = _session.LastRoomState;
            if (last != null)
            {
                UpdateGameTitle(last);
                SyncChatEnabled(last.Manifest);
            }

            var isStarted = IsRoomStarted(last?.Room);
            _lastRoomStarted = isStarted;
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
        _botsById = BuildBots(room);
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

            _announcements.PlayerJoined(info.Username, info.Spectator);
            // Son quand un joueur rejoint la table.
            _sounds.Play(SoundId.RoomJoined);
        }

        foreach (var (id, info) in _participants)
        {
            if (next.ContainsKey(id))
            {
                continue;
            }

            _announcements.PlayerLeft(info.Username, info.Spectator);
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

    private void TrackBots(RoomDto? room)
    {
        if (room == null) return;
        var next = BuildBots(room);

        foreach (var (id, name) in next)
        {
            if (_botsById.ContainsKey(id))
            {
                continue;
            }
            _announcements.BotJoined(name);
        }

        foreach (var (id, name) in _botsById)
        {
            if (next.ContainsKey(id))
            {
                continue;
            }
            _announcements.BotLeft(name);
        }

        _botsById = next;
    }

    private void TrackOwner(RoomDto? room)
    {
        if (room == null) return;
        var nextOwnerId = room.Owner?.Id ?? 0;
        if (nextOwnerId == _ownerId)
        {
            return;
        }

        _ownerId = nextOwnerId;
        _announcements.OwnerChanged(room.Owner?.Username ?? string.Empty);
    }

    private static Dictionary<int, string> BuildBots(RoomDto? room)
    {
        var output = new Dictionary<int, string>();
        if (room == null)
        {
            return output;
        }

        foreach (var b in room.Bots ?? new List<RoomBotDto>())
        {
            if (b == null || b.Id <= 0) continue;
            var name = (b.Name ?? string.Empty).Trim();
            if (name.Length == 0) continue;
            output[b.Id] = name;
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
               code.StartsWith("ui.", StringComparison.OrdinalIgnoreCase);
    }

    private void SetRoomShortcutsForStarted(bool started)
    {
        _tableVm.GameZone.IsStarted = started;
        UpdateStartEligibility(_session.LastRoomState);
        _tableVm.GameZone.Shortcuts.Clear();

        var selfIsSpectator = ComputeSelfSpectator();
        var selfId = TryGetSelfParticipantId();
        var isOwner = selfId > 0 && _ownerId > 0 && selfId == _ownerId;

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
            // "x" reset : raccourci propriétaire (disponible aussi hors partie pour rattraper un état bloqué).
            if (string.Equals(shortcut.Code, RoomShortcutCodes.Reset, StringComparison.OrdinalIgnoreCase) &&
                !isOwner)
            {
                continue;
            }

            static bool IsOwnerOnlyRoomShortcut(ShortcutDefinition s) =>
                string.Equals(s.Code, RoomShortcutCodes.Reset, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.SaveSnapshot, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.TogglePrivacy, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.AddBot, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.RemoveBot, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.Invite, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.Kick, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.Ban, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.TransferOwner, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, RoomShortcutCodes.TableAmbience, StringComparison.OrdinalIgnoreCase);

            // Spectateur : ne propose pas d'actions admin de table (mais garde w/q/i/ctrl+m).
            if (selfIsSpectator && IsOwnerOnlyRoomShortcut(shortcut))
            {
                continue;
            }

            // Actions propriétaire : uniquement si je suis propriétaire.
            if (!isOwner && IsOwnerOnlyRoomShortcut(shortcut))
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

                await _gamePlayVm.RequestTurnInfoAsync().ConfigureAwait(true);
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

            if (_gamePlayVm.Shortcuts is INotifyCollectionChanged notify)
            {
                _onGameplayShortcutsChanged = (_, __) =>
                    _dispatcher.InvokeAsync(SyncGameplayShortcuts, DispatcherPriority.Background);
                notify.CollectionChanged += _onGameplayShortcutsChanged;
            }
        }

	    private async System.Threading.Tasks.Task HandleGameStatusChangedAsync(string previousStatus, string nextStatus)
	    {
	        var wasStarted = string.Equals(previousStatus, "started", StringComparison.OrdinalIgnoreCase);
	        var nowStarted = string.Equals(nextStatus, "started", StringComparison.OrdinalIgnoreCase);

	        // Synchronisation idempotente (évite les races room.status vs game.status) :
	        // on garantit que (IsStarted, Content, raccourcis) correspondent au statut du jeu.
	        var hasGamePlayLoaded = _tableVm.GameZone.Content != null || _gamePlayVm != null;

	        if (nowStarted)
	        {
                CancelRoomStopGraceDelay();
	            if (!_tableVm.GameZone.IsStarted)
	            {
	                SetRoomShortcutsForStarted(started: true);
	                _announcements.TableInfo("Table démarrée.");
	                try { _sounds.Play(SoundId.TableStarted); } catch { }
	                _ = RequestTurnAnnouncementAsync();
	            }
	            else
	            {
	                // S'assure que les raccourcis room.* sont cohérents (owner/spectateur).
	                SetRoomShortcutsForStarted(started: true);
	            }

	            if (!hasGamePlayLoaded)
	            {
	                EnsureGamePlayLoaded();
	            }

	            SyncGameplayShortcuts();
	            return;
	        }

            // Fin de partie : le serveur remet la table en "setup" (reset système).
            // En cas de race/déconnexion courte, forcer un refresh explicite de l'état de table
            // pour réactiver ajout/retrait de bots et relance via Entrée.
            try
            {
                _ = _session.RequestStateRefreshAsync(force: true);
            }
            catch
            {
                // best-effort
            }

	        // Le jeu n'est plus en "started" : on doit pouvoir relancer via Entrée (room.start),
	        // donc on décharge la zone de jeu et on refocus l'ancre.
	        if (_tableVm.GameZone.IsStarted)
	        {
	            SetRoomShortcutsForStarted(started: false);
	        }
	        else
	        {
	            // Même si IsStarted est déjà faux (ex: room.updated reçu avant),
	            // on force un resync des raccourcis pour éviter un état incohérent.
	            SetRoomShortcutsForStarted(started: false);
	        }

	        if (hasGamePlayLoaded)
	        {
                CancelRoomStopGraceDelay();
	            // IMPORTANT (NVDA):
	            // Si le contrôle actuellement focusé (dans la zone de jeu) disparaît, NVDA annonce souvent "indisponible".
	            // On park donc le focus sur un élément stable avant de décharger le contenu.
	            FocusParking.Park();

	            _tableVm.GameZone.Content = null;
	            await UnloadGamePlayVmAsync().ConfigureAwait(true);
	        }

	        // Le contenu a été déchargé, refocus sur l'ancre pour permettre Entrée (room.start).
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
		        if (_onGameplayShortcutsChanged != null &&
		            _gamePlayVm.Shortcuts is System.Collections.Specialized.INotifyCollectionChanged notify)
		        {
		            notify.CollectionChanged -= _onGameplayShortcutsChanged;
		            _onGameplayShortcutsChanged = null;
		        }

	        await _gamePlayVm.DisposeAsync().ConfigureAwait(true);
	        _gamePlayVm = null;
	    }

    private void CancelRoomStopGraceDelay()
    {
        try
        {
            _roomStopGraceCts?.Cancel();
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _roomStopGraceCts?.Dispose();
            _roomStopGraceCts = null;
        }
    }

    private void ApplySpectatorState()
    {
        _selfIsSpectator = ComputeSelfSpectator();
        UpdateStartEligibility(_session.LastRoomState);
        _gamePlayVm?.SetSpectator(_selfIsSpectator);
        SyncGameplayShortcuts();
    }

    private void UpdateStartEligibility(RoomPayloadDto? payload)
    {
        try
        {
            var room = payload?.Room ?? _session.LastRoomState?.Room;
            var manifest = payload?.Manifest ?? _session.LastRoomState?.Manifest;
            if (room == null)
            {
                _tableVm.GameZone.CanStart = false;
                return;
            }

            if (IsRoomStarted(room))
            {
                _tableVm.GameZone.CanStart = false;
                return;
            }

            var selfId = TryGetSelfParticipantId();
            var isOwner = selfId > 0 && _ownerId > 0 && selfId == _ownerId;
            if (!isOwner || _selfIsSpectator)
            {
                _tableVm.GameZone.CanStart = false;
                return;
            }

            var players = room.Players?.Count ?? 0;
            var bots = room.Bots?.Count ?? 0;
            var seatedCount = players + bots;
            var minPlayers = manifest?.MinPlayers ?? _game.MinPlayers;
            if (minPlayers <= 0)
            {
                minPlayers = 1;
            }
            // UX table: don't allow opening start wizard with only one seated participant.
            // Even if a game advertises min=1, table start flow is expected to require at least 2.
            minPlayers = Math.Max(2, minPlayers);

            _tableVm.GameZone.CanStart = seatedCount >= minPlayers;
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
            return _role.IsSpectator;
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
        return _role.IsSpectator;
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
            CancelRoomStopGraceDelay();
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
                _session.RoomUpdated -= _onRoomUpdated;
                _onRoomUpdated = null;
            }
            if (_onSessionError != null)
            {
                _session.ErrorReceived -= _onSessionError;
                _onSessionError = null;
            }

	            if (_gamePlayVm != null)
	            {
	                await UnloadGamePlayVmAsync().ConfigureAwait(true);
	            }

            _bots.Dispose();
            _privacy.Dispose();
            _role.Dispose();
            _info.Dispose();
            _chat.Dispose();

            if (_activeTableAmbienceSound.HasValue)
            {
                try { _sounds.StopLoop(_activeTableAmbienceSound.Value); } catch { }
                _activeTableAmbienceSound = null;
            }

            await _session.LeaveAsync().ConfigureAwait(true);
            await _session.DisposeAsync().ConfigureAwait(true);
        }
        catch
        {
            // Best-effort; le backend ferme la table quand la derniére connexion sort.
        }
    }
}
