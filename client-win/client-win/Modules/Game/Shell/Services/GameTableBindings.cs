using System;
using System.Collections.Specialized;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Threading;
using client_win.Core.Input;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.Play.ViewModels;
using client_win.Modules.Game.Play.Views;
using client_win.Modules.Game.Room.Input;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.Services;

internal sealed class GameTableBindings : IAsyncDisposable
{
    private readonly Dispatcher _dispatcher;
    private readonly CatalogGame _game;
    private readonly RoomSession _session;
    private readonly GameRoomView _tableView;
    private readonly GameRoomViewModel _tableVm;
    private readonly IRoomAnnouncements _announcements;
    private readonly IGameHistorySink _history;

    private readonly RoomBotCommands _bots;
    private readonly RoomPrivacyCommands _privacy;
    private readonly RoomRoleCommands _role;
    private readonly RoomInfoCommands _info;

    private readonly Func<GamePlayViewModel> _createGamePlayVm;
    private GamePlayViewModel? _gamePlayVm;
    private NotifyCollectionChangedEventHandler? _onGameplayShortcutsChanged;

    private Action<RoomPayloadDto>? _onRoomUpdated;
    private Action<RoomAnnouncement>? _onAnnounced;
    private Action<string>? _onSessionError;
    private Action<string>? _onGameMessage;

    private string? _lastStatus;
    private Dictionary<int, (string Username, bool Spectator)> _participants = new();
    private Dictionary<int, string> _botsById = new();
    private int _ownerId = 0;

    public GameTableBindings(
        Dispatcher dispatcher,
        CatalogGame game,
        RoomSession session,
        GameRoomView tableView,
        GameRoomViewModel tableVm,
        IRoomAnnouncements announcements,
        Func<GamePlayViewModel> createGamePlayVm)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _game = game ?? throw new ArgumentNullException(nameof(game));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _tableView = tableView ?? throw new ArgumentNullException(nameof(tableView));
        _tableVm = tableVm ?? throw new ArgumentNullException(nameof(tableVm));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        _createGamePlayVm = createGamePlayVm ?? throw new ArgumentNullException(nameof(createGamePlayVm));
        _history = new GameHistorySink(_dispatcher, _tableVm.History);

        _bots = new RoomBotCommands(_session);
        _privacy = new RoomPrivacyCommands(_session);
        _role = new RoomRoleCommands(_session);
        _info = new RoomInfoCommands(_session);
    }

    public Task AddBotAsync() => _bots.AddBotAsync();
    public Task RemoveBotAsync() => _bots.RemoveLastBotAsync();
    public Task TogglePrivacyAsync() => _privacy.TogglePrivacyAsync();
    public Task ToggleRoleAsync() => _role.ToggleRoleAsync();
    public Task RequestInfoAsync() => _info.RequestInfoAsync();

    public void Attach()
    {
        _lastStatus = _session.LastRoomState?.Room?.Status;
        SeedParticipants(_session.LastRoomState?.Room);

        _onAnnounced = announcement =>
        {
            if (string.IsNullOrWhiteSpace(announcement.Message)) return;
            _history.Add(announcement.Message);
        };
        _announcements.Announced += _onAnnounced;

        _info.InfoReceived += message =>
        {
            _dispatcher.InvokeAsync(() =>
            {
                _announcements.TableInfo(message);
            }, DispatcherPriority.Background);
        };

        _onSessionError = message =>
        {
            _dispatcher.InvokeAsync(() =>
            {
                _announcements.Error(message);
            }, DispatcherPriority.Background);
        };
        _session.ErrorReceived += _onSessionError;

        _bots.BotAdded += name =>
        {
            _dispatcher.InvokeAsync(() =>
            {
                _announcements.BotJoined(name);
            }, DispatcherPriority.Background);
        };

        _bots.BotRemoved += name =>
        {
            _dispatcher.InvokeAsync(() =>
            {
                _announcements.BotLeft(name);
            }, DispatcherPriority.Background);
        };

        _privacy.PrivacyChanged += isPrivate =>
        {
            _dispatcher.InvokeAsync(() =>
            {
                // L'annonce passe via IRoomAnnouncements -> Announced -> historique (puis SR).
                // Ne pas dupliquer via _history.Add / Status (sinon double lecture).
                _announcements.VisibilityChanged(isPrivate);
            }, DispatcherPriority.Background);
        };

        _role.RoleChanged += isSpectator =>
        {
            _dispatcher.InvokeAsync(() =>
            {
                // L'annonce passe via IRoomAnnouncements -> Announced -> historique (puis SR).
                // Ne pas dupliquer via _history.Add / Status (sinon double lecture).
                _announcements.RoleChanged(isSpectator);
            }, DispatcherPriority.Background);
        };

        _onRoomUpdated = payload =>
        {
            UpdateGameTitle(payload);
            TrackParticipants(payload.Room);
            TrackBots(payload.Room);
            TrackOwner(payload.Room);

            var nextStatus = payload.Room?.Status;
            var wasStarted = string.Equals(_lastStatus, "started", StringComparison.OrdinalIgnoreCase);
            var nowStarted = string.Equals(nextStatus, "started", StringComparison.OrdinalIgnoreCase);
            _lastStatus = nextStatus;

            if (!wasStarted && nowStarted)
            {
                _dispatcher.InvokeAsync(() =>
                {
                    SetRoomShortcutsForStarted(started: true);
                    EnsureGamePlayLoaded();
                    SyncGameplayShortcuts();

                    _announcements.TableInfo("Table démarrée.");

                    // Forcer le focus sur la zone de jeu.
                    _tableView.Dispatcher.BeginInvoke(
                        DispatcherPriority.Input,
                        new Action(_tableView.RequestFocusGameZone));
                }, DispatcherPriority.Normal);
                return;
            }

            if (wasStarted && !nowStarted)
            {
                _dispatcher.InvokeAsync(async () =>
                {
                    SetRoomShortcutsForStarted(started: false);
                    _tableVm.GameZone.Content = null;

                    if (_gamePlayVm != null)
                    {
                        if (_onGameMessage != null)
                        {
                            _gamePlayVm.MessageReceived -= _onGameMessage;
                            _onGameMessage = null;
                        }
                        if (_onGameplayShortcutsChanged != null &&
                            _gamePlayVm.Shortcuts is INotifyCollectionChanged notify)
                        {
                            notify.CollectionChanged -= _onGameplayShortcutsChanged;
                            _onGameplayShortcutsChanged = null;
                        }
                        await _gamePlayVm.DisposeAsync().ConfigureAwait(true);
                        _gamePlayVm = null;
                    }

                    _announcements.TableInfo("Table réinitialisée.");

                    // Forcer le focus sur la zone de jeu (le contenu a été déchargé).
                    _ = _tableView.Dispatcher.BeginInvoke(
                        DispatcherPriority.Input,
                        new Action(_tableView.RequestFocusGameZone));
                }, DispatcherPriority.Normal);
            }
        };
        _session.RoomUpdated += _onRoomUpdated;
    }

    public void InitializeFromLastState()
    {
        var last = _session.LastRoomState;
        if (last != null)
        {
            UpdateGameTitle(last);
        }

        var isStarted = string.Equals(_lastStatus, "started", StringComparison.OrdinalIgnoreCase);
        SetRoomShortcutsForStarted(isStarted);
        if (isStarted)
        {
            EnsureGamePlayLoaded();
            SyncGameplayShortcuts();
        }
    }

    private void SeedParticipants(RoomDto? room)
    {
        _participants = BuildParticipants(room);
        _botsById = BuildBots(room);
        _ownerId = room?.Owner?.Id ?? 0;
    }

    private void TrackParticipants(RoomDto room)
    {
        var next = BuildParticipants(room);

        foreach (var (id, info) in next)
        {
            if (_participants.ContainsKey(id))
            {
                continue;
            }

            _announcements.PlayerJoined(info.Username, info.Spectator);
        }

        foreach (var (id, info) in _participants)
        {
            if (next.ContainsKey(id))
            {
                continue;
            }

            _announcements.PlayerLeft(info.Username, info.Spectator);
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

    private void TrackBots(RoomDto room)
    {
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

    private void TrackOwner(RoomDto room)
    {
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
        _tableVm.GameZone.Shortcuts.Clear();

        var shortcuts = RoomShortcuts.Create(
            resetCommand: _tableVm.GameZone.ResetCommand,
            addBotCommand: _tableVm.GameZone.AddBotCommand,
            removeBotCommand: _tableVm.GameZone.RemoveBotCommand,
            announcePlayersCommand: _tableVm.GameZone.AnnouncePlayersCommand,
            announceInfoCommand: _tableVm.GameZone.AnnounceInfoCommand,
            togglePrivacyCommand: _tableVm.GameZone.TogglePrivacyCommand,
            toggleRoleCommand: _tableVm.GameZone.ToggleRoleCommand,
            quitCommand: _tableVm.GameZone.QuitCommand);

        foreach (var shortcut in started ? shortcuts.Where(s => s.AvailableInGame) : shortcuts)
        {
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
        RemoveGameplayShortcuts();

        if (_gamePlayVm == null)
        {
            return;
        }

        foreach (var shortcut in _gamePlayVm.Shortcuts.Where(IsGameplayShortcut))
        {
            _tableVm.GameZone.Shortcuts.Add(shortcut);
        }
    }

    private void EnsureGamePlayLoaded()
    {
        if (_gamePlayVm != null)
        {
            return;
        }

        _gamePlayVm = _createGamePlayVm();
        _onGameMessage = msg =>
            _history.Add(msg);
        _gamePlayVm.MessageReceived += _onGameMessage;

        if (_gamePlayVm.Shortcuts is System.Collections.Specialized.INotifyCollectionChanged notify)
        {
            _onGameplayShortcutsChanged = (_, __) =>
                _dispatcher.InvokeAsync(SyncGameplayShortcuts, DispatcherPriority.Background);
            notify.CollectionChanged += _onGameplayShortcutsChanged;
        }

        _tableVm.GameZone.Content = new GamePlayView { DataContext = _gamePlayVm };
    }

    private void UpdateGameTitle(RoomPayloadDto payload)
    {
        var name = payload.Manifest?.Name;
        if (string.IsNullOrWhiteSpace(name)) return;
        _dispatcher.InvokeAsync(
            () => _tableVm.GameZone.Title = name.Trim(),
            DispatcherPriority.Background);
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (_onAnnounced != null)
            {
                _announcements.Announced -= _onAnnounced;
                _onAnnounced = null;
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
                if (_onGameMessage != null)
                {
                    _gamePlayVm.MessageReceived -= _onGameMessage;
                    _onGameMessage = null;
                }
                if (_onGameplayShortcutsChanged != null &&
                    _gamePlayVm.Shortcuts is INotifyCollectionChanged notify)
                {
                    notify.CollectionChanged -= _onGameplayShortcutsChanged;
                    _onGameplayShortcutsChanged = null;
                }
                await _gamePlayVm.DisposeAsync().ConfigureAwait(true);
                _gamePlayVm = null;
            }

            _bots.Dispose();
            _privacy.Dispose();
            _role.Dispose();
            _info.Dispose();

            await _session.LeaveAsync().ConfigureAwait(true);
            await _session.DisposeAsync().ConfigureAwait(true);
        }
        catch
        {
            // Best-effort; le backend ferme la table quand la derniére connexion sort.
        }
    }
}
