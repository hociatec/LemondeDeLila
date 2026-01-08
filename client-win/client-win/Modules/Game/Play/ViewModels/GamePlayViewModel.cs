using System;
using System.Collections.ObjectModel;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core;
using client_win.Core.Input;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.Play.Dtos;
using client_win.Modules.Game.Play.Services;
using client_win.Modules.Shell.Services;
using Serilog;

namespace client_win.Modules.Game.Play.ViewModels;

public sealed class GamePlayViewModel : ObservableObject, IAsyncDisposable
{
    private sealed record GridAction(string Type, string Label, JsonElement Payload, bool HasOrientation);
    private readonly Dictionary<string, List<GridAction>> _gridActionsByCellKey = new(StringComparer.Ordinal);
    private readonly Dictionary<string, (bool n, bool e, bool s, bool w)> _gridBlockedEdges = new(StringComparer.Ordinal);
    private readonly Dispatcher _dispatcher;
    private readonly IDialogService _dialogs;
    private readonly ISoundService _sounds;
    private readonly Func<CancellationToken, Task<GameSession>> _connect;
    private readonly GamePlayActionDispatcher _actions = new();
    private readonly GamePlayStateProjector _projector = new();
    private readonly GamePlayPanelRequester _panels = new();
    private readonly GamePlayStatePresenter _presenter;
    private readonly GamePlayGameShortcutsController _gameShortcuts;
    private readonly GamePlayChoicesViewModel _choices;
    private readonly PropertyChangedEventHandler _choicesPropertyChangedHandler;
    private readonly GamePlayShortcutsViewModel _shortcuts;
    private readonly GamePlayConnectionController _connection;
    private readonly GamePlayAnnouncementRouter _announcementRouter;
    private int _pendingForcedTurnAnnouncements;
    private int? _lastStateTurnPlayerId;
    private bool _skipLogReplayOnce = true;

    private GameSession? _session;
    private bool _isSpectator;

    private string _connectionStatus = "Connexion au moteur de jeu...";
    private string _stateSummary = "En attente d'un état de jeu (game.state)...";
    private string _pendingText = string.Empty;
    private string _actionsText = string.Empty;
    private bool _isBotThinking;
    private int? _viewerPlayerId;
    private string? _lastGameStatus;

    private readonly AsyncRelayCommand _rollCommand;
    private readonly AsyncRelayCommand _exchangeAcceptCommand;
    private readonly AsyncRelayCommand _exchangeRefuseCommand;
    private readonly AsyncRelayCommand _drawCommand;
    private readonly AsyncRelayCommand _discardSelectCommand;
    private readonly AsyncRelayCommand _askCardSelectCommand;
    private readonly AsyncRelayCommand _pollutionCommand;
    private readonly AsyncRelayCommand<string> _simpleActionFromHintCommand;
    private readonly AsyncRelayCommand _toggleShoppingCommand;
    private readonly AsyncRelayCommand _toggleStableCommand;
    private readonly AsyncRelayCommand _toggleScoreCommand;
    private readonly AsyncRelayCommand _toggleBasketCommand;
    private readonly AsyncRelayCommand _toggleInventoryCommand;
    private readonly AsyncRelayCommand _toggleHandCommand;
    private readonly AsyncRelayCommand _toggleBooksCommand;
    private readonly AsyncRelayCommand _turnInfoCommand;
    private readonly AsyncRelayCommand _positionCommand;
    private readonly AsyncRelayCommand<GridCellViewModel> _gridCellCommand;
    private GridCellViewModel? _selectedPawnCell;
    private int _gridSize = 9;
    private bool _showGridBoard;

    public string GameId { get; }

    public bool ShowGridBoard
    {
        get => _showGridBoard;
        private set => SetProperty(ref _showGridBoard, value);
    }

    public int GridSize
    {
        get => _gridSize;
        private set => SetProperty(ref _gridSize, value);
    }

    public ObservableCollection<GridCellViewModel> GridCells { get; } = new();
    public ICommand GridCellCommand => _gridCellCommand;

    public string GridStatus
    {
        get => _gridStatus;
        private set => SetProperty(ref _gridStatus, value);
    }
    private string _gridStatus = string.Empty;

    public GamePlayViewModel(
        string gameId,
        Func<CancellationToken, Task<GameSession>> connect,
        IDialogService dialogs,
        ISoundService sounds)
    {
        GameId = (gameId ?? string.Empty).Trim();
        _connect = connect ?? throw new ArgumentNullException(nameof(connect));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        _choices = new GamePlayChoicesViewModel(_actions);
        _choicesPropertyChangedHandler = (_, e) =>
        {
            if (string.Equals(e.PropertyName, nameof(GamePlayChoicesViewModel.ChoicesLabel), StringComparison.Ordinal))
            {
                OnPropertyChanged(nameof(ChoicesLabel));
            }
        };
        _choices.PropertyChanged += _choicesPropertyChangedHandler;
        _presenter = new GamePlayStatePresenter(_projector);
        _announcementRouter = new GamePlayAnnouncementRouter();

        _rollCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendRollAsync().ConfigureAwait(true);
            },
            canExecute: () => !_isSpectator && _actions.CanSendRoll(_session));

        _exchangeAcceptCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendFirstAvailableSimpleActionAsync("answer_ask_card_accept", "exchange_accept")
                    .ConfigureAwait(true);
            },
            canExecute: () =>
                !_isSpectator &&
                (_actions.CanSendSimpleAction(_session, "answer_ask_card_accept") ||
                 _actions.CanSendSimpleAction(_session, "exchange_accept")));

        _exchangeRefuseCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendFirstAvailableSimpleActionAsync("answer_ask_card_refuse", "exchange_refuse")
                    .ConfigureAwait(true);
            },
            canExecute: () =>
                !_isSpectator &&
                (_actions.CanSendSimpleAction(_session, "answer_ask_card_refuse") ||
                 _actions.CanSendSimpleAction(_session, "exchange_refuse")));

        _drawCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendSimpleActionAsync("draw").ConfigureAwait(true);
            },
            canExecute: () => !_isSpectator && _actions.CanSendSimpleAction(_session, "draw"));

        _discardSelectCommand = new AsyncRelayCommand(
            () =>
            {
                var state = _session?.LastState;
                if (state != null)
                {
                    _choices.TryStartDiscardSelection(state, msg => MessageReceived?.Invoke(msg));
                }
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _choices.HasDiscardChoices(_session?.LastState));

        _askCardSelectCommand = new AsyncRelayCommand(
            () =>
            {
                var state = _session?.LastState;
                if (state != null)
                {
                    _choices.TryStartAskSelection(state, msg => MessageReceived?.Invoke(msg));
                }
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && CanStartAskCardSelection(_session?.LastState));

        _pollutionCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Pollution);
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && HasPollution(_session?.LastState));

        _simpleActionFromHintCommand = new AsyncRelayCommand<string>(
            async actionType =>
            {
                if (string.IsNullOrWhiteSpace(actionType))
                {
                    return;
                }

                await TrySendSimpleActionAsync(actionType).ConfigureAwait(true);
            },
            canExecute: actionType =>
                !_isSpectator &&
                !string.IsNullOrWhiteSpace(actionType) &&
                _actions.CanSendSimpleAction(_session, actionType));

        _toggleShoppingCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Shopping);
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _projector.HasInterfaceShortcut(_session?.LastState, "shopping"));

        _toggleStableCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Stable);
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _projector.HasInterfaceShortcut(_session?.LastState, "stable"));

        _toggleScoreCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Score);
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _projector.HasInterfaceShortcut(_session?.LastState, "score"));

        _toggleBasketCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Basket);
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _projector.HasInterfaceShortcut(_session?.LastState, "basket"));

        _toggleInventoryCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Inventory);
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _projector.HasInterfaceShortcut(_session?.LastState, "inventory"));

        _toggleHandCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Hand);
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _projector.HasInterfaceShortcut(_session?.LastState, "hand"));

        _toggleBooksCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Books);
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _projector.HasInterfaceShortcut(_session?.LastState, "books"));

        _turnInfoCommand = new AsyncRelayCommand(
            RequestTurnAsync,
            canExecute: () => !_isSpectator && _session != null);

        _positionCommand = new AsyncRelayCommand(
            () =>
            {
                StartPositionRequest();
                return Task.CompletedTask;
            },
            canExecute: () => !_isSpectator && _projector.HasInterfaceShortcut(_session?.LastState, "position"));

        _gridCellCommand = new AsyncRelayCommand<GridCellViewModel>(
            async cell =>
            {
                if (cell == null)
                {
                    return;
                }
                await HandleGridCellActivatedAsync(cell).ConfigureAwait(true);
            },
            canExecute: cell => !_isSpectator && ShowGridBoard && cell != null);

        _shortcuts = new GamePlayShortcutsViewModel(
            _projector,
            toggleShopping: _toggleShoppingCommand,
            toggleStable: _toggleStableCommand,
            toggleScore: _toggleScoreCommand,
            toggleBasket: _toggleBasketCommand,
            toggleInventory: _toggleInventoryCommand,
            toggleHand: _toggleHandCommand,
            toggleBooks: _toggleBooksCommand,
            position: _positionCommand);

        _gameShortcuts = new GamePlayGameShortcutsController(
            _shortcuts.Shortcuts,
            drawCommand: _drawCommand,
            discardSelectCommand: _discardSelectCommand,
            askCardSelectCommand: _askCardSelectCommand,
            pollutionCommand: _pollutionCommand,
            simpleActionCommand: _simpleActionFromHintCommand);

        _connection = new GamePlayConnectionController(
            _dispatcher,
            _connect,
            getSession: () => _session,
            setSession: s => _session = s,
            bindSession: s =>
            {
                s.StateUpdated += OnStateUpdated;
                s.TurnUpdated += OnTurnUpdated;
                s.ErrorReceived += OnServerError;
                s.CommandAckReceived += OnCommandAckReceived;
            },
            unbindSession: s =>
            {
                s.StateUpdated -= OnStateUpdated;
                s.TurnUpdated -= OnTurnUpdated;
                s.ErrorReceived -= OnServerError;
                s.CommandAckReceived -= OnCommandAckReceived;
            },
            setConnectionStatus: status => ConnectionStatus = status,
            refreshCanExecute: RefreshCanExecute);

        BuildStaticShortcuts();
    }

    public ObservableCollection<string> PendingChoices => _choices.PendingChoices;

    public string ChoicesLabel => _choices.ChoicesLabel;

    public ObservableCollection<ShortcutDefinition> Shortcuts => _shortcuts.Shortcuts;

    public event Action<string>? MessageReceived;
    public event Action? GameZoneFocusRequested;

    public void SetSpectator(bool isSpectator)
    {
        if (_isSpectator == isSpectator)
        {
            return;
        }

        _isSpectator = isSpectator;
        RefreshCanExecute();
    }

    public string ConnectionStatus
    {
        get => _connectionStatus;
        private set => SetProperty(ref _connectionStatus, value);
    }

    public string StateSummary
    {
        get => _stateSummary;
        private set => SetProperty(ref _stateSummary, value);
    }

    public string PendingText
    {
        get => _pendingText;
        private set => SetProperty(ref _pendingText, value);
    }

    public string ActionsText
    {
        get => _actionsText;
        private set => SetProperty(ref _actionsText, value);
    }

    private void OnCommandAckReceived(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        ConnectionStatus = message.Trim();
    }

    public bool IsBotThinking
    {
        get => _isBotThinking;
        private set => SetProperty(ref _isBotThinking, value);
    }

    public string? SelectedChoice
    {
        get => _choices.SelectedChoice;
        set
        {
            if (string.Equals(_choices.SelectedChoice, value, StringComparison.Ordinal))
            {
                return;
            }

            _choices.SelectedChoice = value;
            OnPropertyChanged();
        }
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        // Au premier état reçu après connexion, ne pas rejouer tout l'historique :
        // l'historique de la vue doit commencer à partir de l'arrivée du joueur.
        _projector.ResetLogCursor();
        _skipLogReplayOnce = true;
        _lastStateTurnPlayerId = null;

        await _connection.InitializeAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<bool> SubmitSelectedChoiceAsync(CancellationToken cancellationToken = default)
    {
        if (_isSpectator)
        {
            const string message = "Mode spectateur : action de jeu interdite.";
            ConnectionStatus = message;
            MessageReceived?.Invoke(message);
            return false;
        }

        var session = _session;
        if (session == null) return false;

        try
        {
            return await _choices.SubmitSelectedChoiceAsync(
                    session,
                    emitError: message =>
                    {
                        ConnectionStatus = $"Erreur pending: {message}";
                        MessageReceived?.Invoke($"Erreur pending: {message}");
                    },
                    cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de l'envoi d'une action de pending");
            ConnectionStatus = $"Erreur pending: {ex.Message}";
            MessageReceived?.Invoke($"Erreur pending: {ex.Message}");
            return false;
        }
    }

    public async Task TrySendActionAsync(
        string actionType,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        if (_session == null) return;
        if (string.IsNullOrWhiteSpace(actionType)) return;

        if (!CanSendActionNow(_session))
        {
            return;
        }

        if (!_actions.CanSendSimpleAction(_session, actionType))
        {
            return;
        }

        await _session.SendActionsAsync(
                new[] { new GameClientAction(type: actionType, payload: payload) },
                cancellationToken)
            .ConfigureAwait(false);
    }

    private async Task TrySendRollAsync(CancellationToken cancellationToken = default)
    {
        var session = _session;
        if (session == null) return;
        if (!CanSendActionNow(session)) return;
        await _actions.SendRollAsync(session, cancellationToken).ConfigureAwait(false);
    }

    private async Task TrySendSimpleActionAsync(string actionType, CancellationToken cancellationToken = default)
    {
        var session = _session;
        if (session == null) return;
        if (!CanSendActionNow(session)) return;
        await _actions.SendSimpleActionAsync(session, actionType, cancellationToken).ConfigureAwait(false);
    }

    private async Task TrySendFirstAvailableSimpleActionAsync(params string[] actionTypes)
    {
        var session = _session;
        if (session == null) return;

        foreach (var actionType in actionTypes)
        {
            if (string.IsNullOrWhiteSpace(actionType))
            {
                continue;
            }

            if (_actions.CanSendSimpleAction(session, actionType))
            {
                await _actions.SendSimpleActionAsync(session, actionType).ConfigureAwait(false);
                return;
            }
        }
    }

    private async Task RequestAndEmitPanelAsync(PanelMode mode)
    {
        var state = await _panels.RequestFreshStateAsync(_session).ConfigureAwait(true);
        if (state == null)
        {
            return;
        }

        var message = GamePlayPanelRequester.BuildPanelHistoryMessage(state, mode);
        if (!string.IsNullOrWhiteSpace(message))
        {
            MessageReceived?.Invoke(message);
        }
    }

    private void StartPanelRequest(PanelMode mode)
    {
        _ = RequestAndEmitPanelAsync(mode).ContinueWith(
            t =>
            {
                if (t.Exception != null)
                {
                    Log.Error(t.Exception, "Erreur lors de la demande de panel (Shopping/Stable/Score/Basket/Inventory/Hand/Books)");
                }
            },
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted,
            TaskScheduler.Default);
    }

    private void StartPositionRequest()
    {
        _ = RequestAndEmitPositionAsync().ContinueWith(
            t =>
            {
                if (t.Exception != null)
                {
                    Log.Error(t.Exception, "Erreur lors de la demande de position (P)");
                }
            },
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted,
            TaskScheduler.Default);
    }

    private async Task RequestAndEmitPositionAsync()
    {
        var state = await _panels.RequestFreshStateAsync(_session).ConfigureAwait(true);
        if (state == null)
        {
            return;
        }

        var message = GamePlayPanelRequester.BuildPositionHistoryMessage(state);
        if (!string.IsNullOrWhiteSpace(message))
        {
            MessageReceived?.Invoke(message);
        }
    }

    private void BuildStaticShortcuts()
    {
        Shortcuts.Clear();

        Shortcuts.Add(new ShortcutDefinition(
            new KeyGesture(Key.Enter),
            _rollCommand,
            description: "Action: roll (si autorisée)",
            code: "game.roll",
            availableInGame: true));

        Shortcuts.Add(new ShortcutDefinition(
            'a',
            _exchangeAcceptCommand,
            description: "Accepter échange (si proposé)",
            code: "game.exchange.accept",
            availableInGame: true));

        Shortcuts.Add(new ShortcutDefinition(
            'r',
            _exchangeRefuseCommand,
            description: "Refuser échange (si proposé)",
            code: "game.exchange.refuse",
            availableInGame: true));

        Shortcuts.Add(new ShortcutDefinition(
            't',
            _turnInfoCommand,
            description: "A qui est le tour ?",
            code: "ui.turn",
            availableInGame: true));
    }

    private void SyncInterfaceShortcuts(GameStateDto state)
    {
        _shortcuts.SyncInterfaceShortcuts(state);
    }

    private static bool HasAction(GameStateDto state, string actionType)
    {
        if (string.IsNullOrWhiteSpace(actionType))
        {
            return false;
        }

        var actions = state.Actions;
        if (actions == null || actions.Count == 0)
        {
            return false;
        }

        return actions.Any(a => string.Equals(a.Type, actionType, StringComparison.OrdinalIgnoreCase));
    }

    private static bool HasPollution(GameStateDto? state)
    {
        try
        {
            if (state == null)
            {
                return false;
            }

            if (state.Metadata.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (state.Metadata.TryGetProperty("pollution", out _))
            {
                return true;
            }

            return state.Metadata.TryGetProperty("maxPollution", out _);
        }
        catch
        {
            return false;
        }
    }

    private bool CanStartAskCardSelection(GameStateDto? state)
    {
        if (state == null)
        {
            return false;
        }

        if (state.Pending != null)
        {
            return false;
        }

        if (!HasAction(state, "ask_card"))
        {
            return false;
        }

        // Exigences: catalog + playerViews + handCards (exposés par le presenter Dame Nature).
        return GamePlayChoiceBuilder.TryBuildAskCardChoices(state, out _);
    }

    private void OnServerError(string message)
    {
        _dispatcher.InvokeAsync(() =>
        {
            ConnectionStatus = $"Erreur serveur: {message}";
            MessageReceived?.Invoke($"Erreur: {message}");
            RefreshCanExecute();
        }, DispatcherPriority.Background);

        _connection.HandleServerError(message);
    }

    private async Task RequestTurnAsync()
    {
        var session = _session;
        if (session == null) return;
        try
        {
            _pendingForcedTurnAnnouncements = Math.Min(3, _pendingForcedTurnAnnouncements + 1);
            await session.RequestTurnAsync().ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _pendingForcedTurnAnnouncements = Math.Max(0, _pendingForcedTurnAnnouncements - 1);
            Log.Error(ex, "Erreur lors de la demande de game.turn");
        }
    }

    // (public) utilisé uniquement par des intégrations externes éventuelles; sinon le Turn est demandé automatiquement
    // à la connexion (GamePlayConnectionController).
    public Task RequestTurnInfoAsync() => RequestTurnAsync();

    private void OnTurnUpdated(TurnInfoDto info)
    {
        _dispatcher.InvokeAsync(() =>
        {
            var force = _pendingForcedTurnAnnouncements > 0;
            if (force) _pendingForcedTurnAnnouncements = Math.Max(0, _pendingForcedTurnAnnouncements - 1);
            _announcementRouter.TryHandleTurnUpdate(
                info,
                msg => MessageReceived?.Invoke(msg),
                force: force);
        }, DispatcherPriority.Background);
    }

    private void OnStateUpdated(GameStateDto state)
    {
        _panels.OnStateUpdated(state);

        _dispatcher.InvokeAsync(() =>
        {
            if (_skipLogReplayOnce)
            {
                _projector.PrimeLogCursor(state);
                _skipLogReplayOnce = false;
            }

            var presented = _presenter.Present(state!);

            // IMPORTANT:
            // Annoncer d'abord les nouvelles lignes d'historique (ordre serveur),
            // puis seulement ensuite appliquer les changements d'interface (ex: liste de choix),
            // sinon NVDA lit le contrôle (ex: "Échange") avant le message "Case 11: Échange ...".
            foreach (var msg in presented.newLogMessages)
            {
                MessageReceived?.Invoke(msg);
            }

            var nextStatus = state?.Status ?? string.Empty;
            var previousStatus = _lastGameStatus ?? string.Empty;
            _lastGameStatus = nextStatus;
            if (string.Equals(previousStatus, "started", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(nextStatus, "started", StringComparison.OrdinalIgnoreCase))
            {
                GameZoneFocusRequested?.Invoke();
            }

            _viewerPlayerId = state == null ? null : GamePlayExtrasParser.ExtractCurrentPlayerId(state);
            if (state != null)
            {
                _choices.UpdateFromState(state, _viewerPlayerId, CanStartAskCardSelection);
            }

            if (!string.Equals(previousStatus, "finished", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(nextStatus, "finished", StringComparison.OrdinalIgnoreCase))
            {
                TryPlayEndgameSound(state, _viewerPlayerId);
            }

            IsBotThinking = presented.isBotThinking;
            StateSummary = presented.stateSummary;
            PendingText = presented.pendingText;
            ActionsText = presented.actionsText;

            if (state != null)
            {
                _gameShortcuts.Sync(state, CanStartAskCardSelection);
                SyncInterfaceShortcuts(state);
                SyncGridFromState(state);
            }

            RefreshCanExecute();

            if (state != null)
            {
                TryAnnounceTurnFromState(state);
            }
        }, DispatcherPriority.Background);
    }

    private void EnsureGridCells(int size)
    {
        var safe = size <= 0 ? 9 : size;
        GridSize = safe;
        if (GridCells.Count != safe * safe)
        {
            GridCells.Clear();
            for (var y = 0; y < safe; y++)
            {
                for (var x = 0; x < safe; x++)
                {
                    var idx = y * safe + x;
                    GridCells.Add(new GridCellViewModel(x, y, idx));
                }
            }
        }

        foreach (var cell in GridCells)
        {
            cell.MaxColumns = safe;
            cell.MaxRows = safe;
        }
    }

    private void SyncGridFromState(GameStateDto state)
    {
        if (!TryReadGridSize(state, out var size))
        {
            ShowGridBoard = false;
            GridStatus = string.Empty;
            return;
        }

        ShowGridBoard = true;
        EnsureGridCells(size);

        var viewerId = _viewerPlayerId;
        var positions = state.Board?.Positions;
        var cellTagsByKey = TryReadGridCellTags(state);

        foreach (var cell in GridCells)
        {
            cell.OccupantPlayerId = null;
            cell.IsOwnPawn = false;
            cell.IsLegalMove = false;
            cell.CellBorderThickness = new Thickness(1);
            cell.WallNorth = false;
            cell.WallSouth = false;
            cell.WallWest = false;
            cell.WallEast = false;
            cell.CanPlaceWallH = false;
            cell.CanPlaceWallV = false;
            cell.IsCarryingPawn = _selectedPawnCell != null;
            cell.IsSelectedPawn = false;
            cell.CellTags = Array.Empty<string>();
        }

        if (positions != null)
        {
            foreach (var kv in positions)
            {
                if (!int.TryParse(kv.Key, out var pid))
                {
                    continue;
                }

                var idx = kv.Value;
                if (idx < 0 || idx >= GridCells.Count)
                {
                    continue;
                }

                GridCells[idx].OccupantPlayerId = pid;
                if (viewerId != null && pid == viewerId.Value)
                {
                    GridCells[idx].IsOwnPawn = true;
                }
            }
        }

        SyncGridStatus(state);
        ApplyGridWallsAccessibility(state);

        BuildGridActionsIndex(state);
        foreach (var cell in GridCells)
        {
            var k = $"{cell.X},{cell.Y}";
            if (cellTagsByKey.TryGetValue(k, out var tags) && tags.Length > 0)
            {
                cell.CellTags = tags;
            }

            if (!_gridActionsByCellKey.TryGetValue(k, out var actions) || actions.Count == 0)
            {
                cell.ActionLabels = Array.Empty<string>();
                continue;
            }

            cell.ActionLabels = actions.Select(a => a.Label).Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
            cell.IsLegalMove = actions.Any(a => !a.HasOrientation);
            cell.CanPlaceWallH = actions.Any(a => a.HasOrientation && HasOrientation(a.Payload, "h"));
            cell.CanPlaceWallV = actions.Any(a => a.HasOrientation && HasOrientation(a.Payload, "v"));
        }

        var currentOwnPawn = GridCells.FirstOrDefault(c => c.IsOwnPawn);
        if (_selectedPawnCell != null && currentOwnPawn != _selectedPawnCell)
        {
            _selectedPawnCell = null;
        }

        if (_selectedPawnCell != null)
        {
            _selectedPawnCell.IsSelectedPawn = true;
        }
    }

    private void BuildGridActionsIndex(GameStateDto state)
    {
        _gridActionsByCellKey.Clear();

        var labelsByKeyAndType = TryReadGridCellActionLabels(state);

        foreach (var action in state.Actions ?? new List<GameAvailableActionDto>())
        {
            if (action == null) continue;
            if (action.Payload.ValueKind != JsonValueKind.Object) continue;

            if (!action.Payload.TryGetProperty("x", out var xNode) ||
                !action.Payload.TryGetProperty("y", out var yNode) ||
                !xNode.TryGetInt32(out var x) ||
                !yNode.TryGetInt32(out var y))
            {
                continue;
            }

            var key = $"{x},{y}";
            var hasOrientation = action.Payload.TryGetProperty("o", out var oNode) && oNode.ValueKind == JsonValueKind.String;

            var orientation = OrientationValue(action.Payload);
            var label = action.Label;
            if (labelsByKeyAndType.TryGetValue((key, action.Type, orientation), out var resolved))
            {
                label = resolved;
            }
            if (string.IsNullOrWhiteSpace(label))
            {
                label = action.Type;
            }

            if (!_gridActionsByCellKey.TryGetValue(key, out var list))
            {
                list = new List<GridAction>();
                _gridActionsByCellKey[key] = list;
            }

            list.Add(new GridAction(action.Type, label!, action.Payload, hasOrientation));
        }
    }

    private static string OrientationValue(JsonElement payload)
    {
        try
        {
            if (payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty("o", out var oNode) &&
                oNode.ValueKind == JsonValueKind.String)
            {
                return (oNode.GetString() ?? string.Empty).Trim().ToLowerInvariant();
            }
        }
        catch
        {
            // ignore
        }
        return string.Empty;
    }

    private static bool HasOrientation(JsonElement payload, string expected)
    {
        var o = OrientationValue(payload);
        return string.Equals(o, expected, StringComparison.OrdinalIgnoreCase);
    }

    private static Dictionary<(string key, string type, string o), string> TryReadGridCellActionLabels(GameStateDto state)
    {
        var dict = new Dictionary<(string, string, string), string>();
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object ||
                !grid.TryGetProperty("cellActions", out var cellActions) ||
                cellActions.ValueKind != JsonValueKind.Object)
            {
                return dict;
            }

            foreach (var cellProp in cellActions.EnumerateObject())
            {
                var key = cellProp.Name;
                if (cellProp.Value.ValueKind != JsonValueKind.Array) continue;
                foreach (var item in cellProp.Value.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object) continue;
                    var type = item.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String ? (t.GetString() ?? "") : "";
                    var label = item.TryGetProperty("label", out var l) && l.ValueKind == JsonValueKind.String ? (l.GetString() ?? "") : "";
                    var o = string.Empty;
                    if (item.TryGetProperty("payload", out var p) && p.ValueKind == JsonValueKind.Object)
                    {
                        o = OrientationValue(p);
                    }

                    if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(type) && !string.IsNullOrWhiteSpace(label))
                    {
                        dict[(key, type.Trim(), o)] = label.Trim();
                    }
                }
            }
        }
        catch
        {
            // ignore
        }

        return dict;
    }

    private static Dictionary<string, string[]> TryReadGridCellTags(GameStateDto state)
    {
        var dict = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object ||
                !grid.TryGetProperty("cellTags", out var cellTags) ||
                cellTags.ValueKind != JsonValueKind.Object)
            {
                return dict;
            }

            foreach (var cellProp in cellTags.EnumerateObject())
            {
                if (string.IsNullOrWhiteSpace(cellProp.Name)) continue;
                if (cellProp.Value.ValueKind != JsonValueKind.Array) continue;
                var tags = cellProp.Value.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => (e.GetString() ?? string.Empty).Trim())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                if (tags.Length > 0)
                {
                    dict[cellProp.Name.Trim()] = tags;
                }
            }
        }
        catch
        {
            // ignore
        }
        return dict;
    }

    private void SyncGridStatus(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object)
            {
                GridStatus = string.Empty;
                return;
            }

            if (grid.TryGetProperty("statusLines", out var linesNode) &&
                linesNode.ValueKind == JsonValueKind.Array)
            {
                var lines = linesNode.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => (e.GetString() ?? string.Empty).Trim())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToArray();
                GridStatus = lines.Length > 0 ? string.Join(" ", lines) : string.Empty;
                return;
            }

            GridStatus = string.Empty;
        }
        catch
        {
            GridStatus = string.Empty;
        }
    }

    private void ApplyGridWallsAccessibility(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object ||
                !grid.TryGetProperty("blockedEdges", out var blocked) ||
                blocked.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            _gridBlockedEdges.Clear();
            foreach (var prop in blocked.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var edges = prop.Value;
                var n = edges.TryGetProperty("n", out var nn) && nn.ValueKind == JsonValueKind.True;
                var e = edges.TryGetProperty("e", out var ee) && ee.ValueKind == JsonValueKind.True;
                var s = edges.TryGetProperty("s", out var ss) && ss.ValueKind == JsonValueKind.True;
                var w = edges.TryGetProperty("w", out var ww) && ww.ValueKind == JsonValueKind.True;
                _gridBlockedEdges[prop.Name] = (n, e, s, w);
            }

            for (var y = 0; y < GridSize; y++)
            {
                for (var x = 0; x < GridSize; x++)
                {
                    var idx = y * GridSize + x;
                    if (idx < 0 || idx >= GridCells.Count) continue;
                    var cell = GridCells[idx];

                    if (!blocked.TryGetProperty($"{x},{y}", out var edges) ||
                        edges.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    cell.WallNorth = edges.TryGetProperty("n", out var n) && n.ValueKind == JsonValueKind.True;
                    cell.WallEast = edges.TryGetProperty("e", out var e) && e.ValueKind == JsonValueKind.True;
                    cell.WallSouth = edges.TryGetProperty("s", out var s) && s.ValueKind == JsonValueKind.True;
                    cell.WallWest = edges.TryGetProperty("w", out var w) && w.ValueKind == JsonValueKind.True;

                    var thick = 4.0;
                    cell.CellBorderThickness = new Thickness(
                        cell.WallWest ? thick : 1,
                        cell.WallNorth ? thick : 1,
                        cell.WallEast ? thick : 1,
                        cell.WallSouth ? thick : 1);
                }
            }
        }
        catch
        {
            // ignore
        }
    }

    private static List<(int x, int y)> ExtractCorridorLegalWalls(GameStateDto state, string orientation)
    {
        var result = new List<(int x, int y)>();
        var actions = state.Actions;
        if (actions == null) return result;
        var o = string.Equals(orientation, "v", StringComparison.OrdinalIgnoreCase) ? "v" : "h";

        foreach (var action in actions)
        {
            if (action == null) continue;
            if (!string.Equals(action.Type, "corridor_place_wall", StringComparison.OrdinalIgnoreCase)) continue;

            try
            {
                if (action.Payload.ValueKind != JsonValueKind.Object) continue;
                if (!action.Payload.TryGetProperty("x", out var xNode) ||
                    !action.Payload.TryGetProperty("y", out var yNode) ||
                    !action.Payload.TryGetProperty("o", out var oNode))
                {
                    continue;
                }

                if (!xNode.TryGetInt32(out var x) || !yNode.TryGetInt32(out var y)) continue;
                var ao = oNode.ValueKind == JsonValueKind.String ? (oNode.GetString() ?? "") : "";
                if (!string.Equals(ao, o, StringComparison.OrdinalIgnoreCase)) continue;
                result.Add((x, y));
            }
            catch
            {
                // ignore
            }
        }

        return result;
    }

    private static int? TryReadCorridorSize(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (!state.Extras.TryGetProperty("corridor", out var corridor) ||
                corridor.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (!corridor.TryGetProperty("size", out var sizeNode))
            {
                return null;
            }

            if (sizeNode.ValueKind == JsonValueKind.Number && sizeNode.TryGetInt32(out var asInt))
            {
                return asInt;
            }

            if (sizeNode.ValueKind == JsonValueKind.String && int.TryParse(sizeNode.GetString(), out var parsed))
            {
                return parsed;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    private static bool TryReadGridSize(GameStateDto state, out int size)
    {
        size = 0;
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (state.Extras.TryGetProperty("grid", out var grid) &&
                grid.ValueKind == JsonValueKind.Object &&
                grid.TryGetProperty("size", out var sizeNode))
            {
                if (sizeNode.ValueKind == JsonValueKind.Number && sizeNode.TryGetInt32(out var asInt))
                {
                    size = asInt;
                    return size > 0;
                }

                if (sizeNode.ValueKind == JsonValueKind.String &&
                    int.TryParse(sizeNode.GetString(), out var parsed))
                {
                    size = parsed;
                    return size > 0;
                }
            }

            // Fallback legacy.
            var legacy = TryReadCorridorSize(state);
            if (legacy != null && legacy.Value > 0)
            {
                size = legacy.Value;
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    private static List<(int x, int y)> ExtractCorridorLegalMoves(GameStateDto state)
    {
        var result = new List<(int x, int y)>();
        var actions = state.Actions;
        if (actions == null)
        {
            return result;
        }

        foreach (var action in actions)
        {
            if (action == null)
            {
                continue;
            }

            if (!string.Equals(action.Type, "corridor_move", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            try
            {
                if (action.Payload.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                if (!action.Payload.TryGetProperty("x", out var xNode) ||
                    !action.Payload.TryGetProperty("y", out var yNode))
                {
                    continue;
                }

                if (!xNode.TryGetInt32(out var x) || !yNode.TryGetInt32(out var y))
                {
                    continue;
                }

                result.Add((x, y));
            }
            catch
            {
                // ignore
            }
        }

        return result;
    }

    private async Task HandleGridCellActivatedAsync(GridCellViewModel cell)
    {
        var session = _session;
        if (session == null || !session.IsConnected)
        {
            return;
        }

        if (_viewerPlayerId == null || _viewerPlayerId.Value <= 0)
        {
            return;
        }

        if (cell.IsOwnPawn)
        {
            if (_selectedPawnCell == cell)
            {
                _selectedPawnCell = null;
                MessageReceived?.Invoke("Pion reposé.");
            }
            else
            {
                _selectedPawnCell = cell;
                MessageReceived?.Invoke("Pion pris.");
            }

            if (session.LastState != null)
            {
                SyncGridFromState(session.LastState);
            }
            return;
        }

        var key = $"{cell.X},{cell.Y}";
        _gridActionsByCellKey.TryGetValue(key, out var actionsHere);
        actionsHere ??= new List<GridAction>();

        if (_selectedPawnCell != null)
        {
            var moveActions = actionsHere.Where(a => !a.HasOrientation).ToList();
            if (moveActions.Count == 0)
            {
                var reason = TryExplainBlockedMove(_selectedPawnCell, cell);
                MessageReceived?.Invoke(reason ?? "Déplacement interdit.");
                return;
            }

            var chosen = await PickActionAsync("Action", $"Choisir une action (colonne {cell.Column}, ligne {cell.Row}) :", moveActions)
                .ConfigureAwait(true);
            if (chosen == null)
            {
                return;
            }

            await SendGridActionAsync(chosen).ConfigureAwait(true);
            _selectedPawnCell = null;
            MessageReceived?.Invoke("Action envoyée.");
            if (session.LastState != null)
            {
                SyncGridFromState(session.LastState);
            }
            return;
        }

        // Pas de pion en main: si on a des actions, on choisit. Pour les murs, on force le choix Horizontal/Vertical.
        var wallActions = actionsHere.Where(a => a.HasOrientation).ToList();
        if (wallActions.Count > 0)
        {
            await PromptAndSendWallAsync(cell, wallActions).ConfigureAwait(true);
            if (session.LastState != null)
            {
                SyncGridFromState(session.LastState);
            }
            return;
        }

        if (actionsHere.Count == 0)
        {
            return;
        }

        var any = await PickActionAsync("Action", $"Choisir une action (colonne {cell.Column}, ligne {cell.Row}) :", actionsHere)
            .ConfigureAwait(true);
        if (any == null)
        {
            return;
        }

        await SendGridActionAsync(any).ConfigureAwait(true);
        MessageReceived?.Invoke("Action envoyée.");
        if (session.LastState != null)
        {
            SyncGridFromState(session.LastState);
        }
    }

    private async Task<GridAction?> PickActionAsync(string title, string message, List<GridAction> actions)
    {
        if (actions.Count == 0)
        {
            return null;
        }
        if (actions.Count == 1)
        {
            return actions[0];
        }

        var labels = new List<string>();
        var byLabel = new Dictionary<string, GridAction>(StringComparer.Ordinal);
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var action in actions)
        {
            var baseLabel = string.IsNullOrWhiteSpace(action.Label) ? action.Type : action.Label;
            counts.TryGetValue(baseLabel, out var n);
            n++;
            counts[baseLabel] = n;
            var label = n == 1 ? baseLabel : $"{baseLabel} ({n})";
            labels.Add(label);
            byLabel[label] = action;
        }

        var picked = await _dialogs.Pick(title, message, labels, okText: "Valider", cancelText: "Annuler").ConfigureAwait(true);
        if (picked == null)
        {
            return null;
        }

        return byLabel.TryGetValue(picked, out var chosen) ? chosen : null;
    }

    private string? TryExplainBlockedMove(GridCellViewModel from, GridCellViewModel to)
    {
        if (from == null || to == null)
        {
            return null;
        }

        if (to.IsOccupied)
        {
            return "Déplacement interdit : case occupée.";
        }

        var dx = to.X - from.X;
        var dy = to.Y - from.Y;
        if (Math.Abs(dx) + Math.Abs(dy) == 1)
        {
            var key = $"{from.X},{from.Y}";
            if (_gridBlockedEdges.TryGetValue(key, out var edges))
            {
                if (dx == 1 && edges.e) return "Déplacement interdit : mur vertical entre ces colonnes.";
                if (dx == -1 && edges.w) return "Déplacement interdit : mur vertical entre ces colonnes.";
                if (dy == 1 && edges.s) return "Déplacement interdit : mur horizontal entre ces lignes.";
                if (dy == -1 && edges.n) return "Déplacement interdit : mur horizontal entre ces lignes.";
            }
            return "Déplacement interdit.";
        }

        return "Déplacement interdit.";
    }

    private async Task PromptAndSendWallAsync(GridCellViewModel cell, List<GridAction> wallActions)
    {
        var horizontal = wallActions.FirstOrDefault(a => HasOrientation(a.Payload, "h"));
        var vertical = wallActions.FirstOrDefault(a => HasOrientation(a.Payload, "v"));

        if (horizontal != null && vertical != null)
        {
            var choice = await _dialogs.Choose(
                    title: "Mur",
                    message: $"Poser un mur à colonne {cell.Column}, ligne {cell.Row} :",
                    primaryText: "Horizontal",
                    secondaryText: "Vertical",
                    cancelText: "Annuler")
                .ConfigureAwait(true);

            if (choice == DialogChoice.Primary)
            {
                await SendGridActionAsync(horizontal).ConfigureAwait(true);
                MessageReceived?.Invoke($"Mur horizontal posé à colonne {cell.Column}, ligne {cell.Row}.");
            }
            else if (choice == DialogChoice.Secondary)
            {
                await SendGridActionAsync(vertical).ConfigureAwait(true);
                MessageReceived?.Invoke($"Mur vertical posé à colonne {cell.Column}, ligne {cell.Row}.");
            }

            return;
        }

        var only = horizontal ?? vertical ?? (wallActions.Count > 0 ? wallActions[0] : null);
        if (only == null)
        {
            return;
        }

        var ok = await _dialogs.Confirm("Mur", $"Poser un mur à colonne {cell.Column}, ligne {cell.Row} ?", okText: "Poser", cancelText: "Annuler")
            .ConfigureAwait(true);
        if (ok == true)
        {
            await SendGridActionAsync(only).ConfigureAwait(true);
            MessageReceived?.Invoke($"Mur posé à colonne {cell.Column}, ligne {cell.Row}.");
        }
    }

    private async Task SendGridActionAsync(GridAction action)
    {
        var session = _session;
        if (session == null || !session.IsConnected)
        {
            return;
        }

        try
        {
            var payload = JsonToObject(action.Payload);
            await session.SendActionsAsync(new[] { new GameClientAction(action.Type, payload: payload) }, CancellationToken.None)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            try
            {
                await _dialogs.ShowError("Jeu", $"Impossible d'envoyer l'action : {ex.Message}").ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
        }
    }

    private static object? JsonToObject(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Undefined:
            case JsonValueKind.Null:
                return null;
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
                return false;
            case JsonValueKind.Number:
                if (element.TryGetInt64(out var l)) return l;
                if (element.TryGetDouble(out var d)) return d;
                return null;
            case JsonValueKind.String:
                return element.GetString();
            case JsonValueKind.Array:
            {
                var list = new List<object?>();
                foreach (var item in element.EnumerateArray())
                {
                    list.Add(JsonToObject(item));
                }
                return list;
            }
            case JsonValueKind.Object:
            {
                var dict = new Dictionary<string, object?>(StringComparer.Ordinal);
                foreach (var prop in element.EnumerateObject())
                {
                    dict[prop.Name] = JsonToObject(prop.Value);
                }
                return dict;
            }
            default:
                return null;
        }
    }

    private void TryPlayEndgameSound(GameStateDto? state, int? viewerPlayerId)
    {
        if (state == null || viewerPlayerId == null || viewerPlayerId.Value <= 0)
        {
            return;
        }

        var winnerId = TryExtractWinnerPlayerId(state);
        if (winnerId == null)
        {
            return;
        }

        if (winnerId.Value == viewerPlayerId.Value)
        {
            _sounds.Play(SoundId.GameVictory);
            return;
        }

        _sounds.Play(SoundId.GameDefeat);
    }

    private static int? TryExtractWinnerPlayerId(GameStateDto? state)
    {
        if (state == null)
        {
            return null;
        }

        // Best-effort: games may store winner info in metadata under various keys.
        static int? ReadWinnerId(System.Text.Json.JsonElement element)
        {
            if (element.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return null;
            }

            foreach (var key in new[] { "winnerPlayerId", "winnerId", "winner_id" })
            {
                if (element.TryGetProperty(key, out var prop) &&
                    prop.ValueKind == System.Text.Json.JsonValueKind.Number)
                {
                    try { return prop.GetInt32(); } catch { /* ignore */ }
                }
            }

            return null;
        }

        return ReadWinnerId(state.Metadata) ?? ReadWinnerId(state.Extras);
    }

    private void TryAnnounceTurnFromState(GameStateDto state)
    {
        if (state == null)
        {
            return;
        }

        if (!string.Equals(state.Status, "started", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var currentPlayerId = state.Turn?.CurrentPlayerId;
        if (currentPlayerId == null)
        {
            return;
        }

        if (_lastStateTurnPlayerId == currentPlayerId)
        {
            return;
        }

        _lastStateTurnPlayerId = currentPlayerId;

        var username = state.Players?
            .FirstOrDefault(p => p != null && p.Id == currentPlayerId.Value)?
            .Username;

        _announcementRouter.TryHandleTurnUpdate(
            new TurnInfoDto
            {
                CurrentPlayerId = currentPlayerId,
                CurrentPlayerUsername = string.IsNullOrWhiteSpace(username) ? null : username.Trim()
            },
            emitHistoryMessage: _ => { });
    }

    private bool CanSendActionNow(GameSession session)
    {
        // Le client ne décide pas: il envoie, le serveur tranche (actions disponibles + validation).
        // Ici on évite uniquement d'envoyer si la session est inexistante/déconnectée.
        return session.IsConnected && !_isSpectator;
    }

    private void RefreshCanExecute()
    {
        _rollCommand.RaiseCanExecuteChanged();
        _exchangeAcceptCommand.RaiseCanExecuteChanged();
        _exchangeRefuseCommand.RaiseCanExecuteChanged();
        _drawCommand.RaiseCanExecuteChanged();
        _discardSelectCommand.RaiseCanExecuteChanged();
        _askCardSelectCommand.RaiseCanExecuteChanged();
        _pollutionCommand.RaiseCanExecuteChanged();
        _simpleActionFromHintCommand.RaiseCanExecuteChanged();
        _toggleShoppingCommand.RaiseCanExecuteChanged();
        _toggleScoreCommand.RaiseCanExecuteChanged();
        _toggleBasketCommand.RaiseCanExecuteChanged();
        _toggleInventoryCommand.RaiseCanExecuteChanged();
        _toggleHandCommand.RaiseCanExecuteChanged();
        _toggleBooksCommand.RaiseCanExecuteChanged();
        _turnInfoCommand.RaiseCanExecuteChanged();
        _positionCommand.RaiseCanExecuteChanged();
    }

    public async ValueTask DisposeAsync()
    {
        _choices.PropertyChanged -= _choicesPropertyChangedHandler;
        await _connection.DisposeAsync().ConfigureAwait(false);
    }
}
