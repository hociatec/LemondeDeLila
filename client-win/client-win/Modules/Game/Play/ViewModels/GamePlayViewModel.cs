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
    private readonly AsyncRelayCommand<CorridorCellViewModel> _corridorCellCommand;
    private CorridorCellViewModel? _selectedCorridorPawnCell;
    private int _corridorSize = 9;

    public string GameId { get; }
    public bool ShowCorridorBoard => string.Equals(GameId, "corridor", StringComparison.OrdinalIgnoreCase);

    public int CorridorSize
    {
        get => _corridorSize;
        private set => SetProperty(ref _corridorSize, value);
    }

    public ObservableCollection<CorridorCellViewModel> CorridorCells { get; } = new();
    public ICommand CorridorCellCommand => _corridorCellCommand;

    public string CorridorWallsRemaining
    {
        get => _corridorWallsRemaining;
        private set => SetProperty(ref _corridorWallsRemaining, value);
    }
    private string _corridorWallsRemaining = string.Empty;

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

        _corridorCellCommand = new AsyncRelayCommand<CorridorCellViewModel>(
            async cell =>
            {
                if (cell == null)
                {
                    return;
                }
                await HandleCorridorCellActivatedAsync(cell).ConfigureAwait(true);
            },
            canExecute: cell => !_isSpectator && ShowCorridorBoard && cell != null);

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

        if (ShowCorridorBoard)
        {
            EnsureCorridorCells(CorridorSize);
        }
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
                if (ShowCorridorBoard)
                {
                    SyncCorridorFromState(state);
                }
            }

            RefreshCanExecute();

            if (state != null)
            {
                TryAnnounceTurnFromState(state);
            }
        }, DispatcherPriority.Background);
    }

    private void EnsureCorridorCells(int size)
    {
        var safe = size <= 0 ? 9 : size;
        CorridorSize = safe;
        if (CorridorCells.Count == safe * safe)
        {
            return;
        }

        CorridorCells.Clear();
        for (var y = 0; y < safe; y++)
        {
            for (var x = 0; x < safe; x++)
            {
                var idx = y * safe + x;
                CorridorCells.Add(new CorridorCellViewModel(x, y, idx));
            }
        }
    }

    private void SyncCorridorFromState(GameStateDto state)
    {
        var size = TryReadCorridorSize(state) ?? CorridorSize;
        EnsureCorridorCells(size);

        var viewerId = _viewerPlayerId;
        var positions = state.Board?.Positions;

        foreach (var cell in CorridorCells)
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
            cell.IsCarryingPawn = _selectedCorridorPawnCell != null;
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
                if (idx < 0 || idx >= CorridorCells.Count)
                {
                    continue;
                }

                CorridorCells[idx].OccupantPlayerId = pid;
                if (viewerId != null && pid == viewerId.Value)
                {
                    CorridorCells[idx].IsOwnPawn = true;
                }
            }
        }

        SyncCorridorWallsRemaining(state, viewerId);
        ApplyCorridorWallsToBorders(state);
        ApplyCorridorWallsAccessibility(state);

        var legalMoves = ExtractCorridorLegalMoves(state);
        foreach (var (x, y) in legalMoves)
        {
            var idx = y * CorridorSize + x;
            if (idx >= 0 && idx < CorridorCells.Count)
            {
                CorridorCells[idx].IsLegalMove = true;
            }
        }

        var legalWallsH = ExtractCorridorLegalWalls(state, "h");
        foreach (var (x, y) in legalWallsH)
        {
            var idx = y * CorridorSize + x;
            if (idx >= 0 && idx < CorridorCells.Count)
            {
                CorridorCells[idx].CanPlaceWallH = true;
            }
        }

        var legalWallsV = ExtractCorridorLegalWalls(state, "v");
        foreach (var (x, y) in legalWallsV)
        {
            var idx = y * CorridorSize + x;
            if (idx >= 0 && idx < CorridorCells.Count)
            {
                CorridorCells[idx].CanPlaceWallV = true;
            }
        }

        var currentOwnPawn = CorridorCells.FirstOrDefault(c => c.IsOwnPawn);
        if (_selectedCorridorPawnCell != null && currentOwnPawn != _selectedCorridorPawnCell)
        {
            _selectedCorridorPawnCell.IsSelectedPawn = false;
            _selectedCorridorPawnCell = null;
        }

        if (_selectedCorridorPawnCell != null)
        {
            _selectedCorridorPawnCell.IsSelectedPawn = true;
        }
    }

    private void SyncCorridorWallsRemaining(GameStateDto state, int? viewerId)
    {
        if (viewerId == null || viewerId.Value <= 0)
        {
            CorridorWallsRemaining = string.Empty;
            return;
        }

        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("corridor", out var corridor) ||
                corridor.ValueKind != JsonValueKind.Object ||
                !corridor.TryGetProperty("wallsRemainingByPlayerId", out var map) ||
                map.ValueKind != JsonValueKind.Object)
            {
                CorridorWallsRemaining = string.Empty;
                return;
            }

            var key = viewerId.Value.ToString();
            if (map.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var n))
            {
                CorridorWallsRemaining = $"Murs restants : {n}";
                return;
            }

            CorridorWallsRemaining = string.Empty;
        }
        catch
        {
            CorridorWallsRemaining = string.Empty;
        }
    }

    private void ApplyCorridorWallsToBorders(GameStateDto state)
    {
        // On dessine les murs via l'épaisseur des bordures des cellules adjacentes.
        // Convention backend:
        // - Mur horizontal (x,y): entre y et y+1, affecte les bords bas des cellules (x,y) et (x+1,y)
        // - Mur vertical (x,y): entre x et x+1, affecte les bords droit des cellules (x,y) et (x,y+1)
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("corridor", out var corridor) ||
                corridor.ValueKind != JsonValueKind.Object ||
                !corridor.TryGetProperty("walls", out var walls) ||
                walls.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var thickness = 4.0;

            if (walls.TryGetProperty("h", out var h) && h.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in h.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.String) continue;
                    var parts = (item.GetString() ?? string.Empty).Split(',');
                    if (parts.Length != 2) continue;
                    if (!int.TryParse(parts[0], out var x) || !int.TryParse(parts[1], out var y)) continue;

                    ApplyCellBottomBorder(x, y, thickness);
                    ApplyCellBottomBorder(x + 1, y, thickness);
                }
            }

            if (walls.TryGetProperty("v", out var v) && v.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in v.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.String) continue;
                    var parts = (item.GetString() ?? string.Empty).Split(',');
                    if (parts.Length != 2) continue;
                    if (!int.TryParse(parts[0], out var x) || !int.TryParse(parts[1], out var y)) continue;

                    ApplyCellRightBorder(x, y, thickness);
                    ApplyCellRightBorder(x, y + 1, thickness);
                }
            }
        }
        catch
        {
            // ignore
        }
    }

    private void ApplyCorridorWallsAccessibility(GameStateDto state)
    {
        // Recalcule, pour chaque case, la présence de murs sur ses 4 côtés.
        // On réutilise la même logique que côté backend (mur horizontal/vertical stocké en ancrage x,y).
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("corridor", out var corridor) ||
                corridor.ValueKind != JsonValueKind.Object ||
                !corridor.TryGetProperty("walls", out var walls) ||
                walls.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var setH = new HashSet<string>(StringComparer.Ordinal);
            var setV = new HashSet<string>(StringComparer.Ordinal);

            if (walls.TryGetProperty("h", out var h) && h.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in h.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.String) continue;
                    var s = (item.GetString() ?? string.Empty).Trim();
                    if (!string.IsNullOrWhiteSpace(s)) setH.Add(s);
                }
            }

            if (walls.TryGetProperty("v", out var v) && v.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in v.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.String) continue;
                    var s = (item.GetString() ?? string.Empty).Trim();
                    if (!string.IsNullOrWhiteSpace(s)) setV.Add(s);
                }
            }

            bool HasH(int x, int y) => setH.Contains($"{x},{y}");
            bool HasV(int x, int y) => setV.Contains($"{x},{y}");

            for (var y = 0; y < CorridorSize; y++)
            {
                for (var x = 0; x < CorridorSize; x++)
                {
                    var idx = y * CorridorSize + x;
                    if (idx < 0 || idx >= CorridorCells.Count) continue;
                    var cell = CorridorCells[idx];

                    // Mur sud : entre (x,y) et (x,y+1)
                    var south = HasH(x, y) || HasH(x - 1, y);
                    // Mur nord : entre (x,y-1) et (x,y)
                    var north = HasH(x, y - 1) || HasH(x - 1, y - 1);
                    // Mur est : entre (x,y) et (x+1,y)
                    var east = HasV(x, y) || HasV(x, y - 1);
                    // Mur ouest : entre (x-1,y) et (x,y)
                    var west = HasV(x - 1, y) || HasV(x - 1, y - 1);

                    cell.WallNorth = north;
                    cell.WallSouth = south;
                    cell.WallEast = east;
                    cell.WallWest = west;
                }
            }
        }
        catch
        {
            // ignore
        }
    }

    private void ApplyCellBottomBorder(int x, int y, double thickness)
    {
        if (x < 0 || y < 0 || x >= CorridorSize || y >= CorridorSize) return;
        var idx = y * CorridorSize + x;
        if (idx < 0 || idx >= CorridorCells.Count) return;
        var t = CorridorCells[idx].CellBorderThickness;
        CorridorCells[idx].CellBorderThickness = new Thickness(t.Left, t.Top, t.Right, Math.Max(t.Bottom, thickness));
    }

    private void ApplyCellRightBorder(int x, int y, double thickness)
    {
        if (x < 0 || y < 0 || x >= CorridorSize || y >= CorridorSize) return;
        var idx = y * CorridorSize + x;
        if (idx < 0 || idx >= CorridorCells.Count) return;
        var t = CorridorCells[idx].CellBorderThickness;
        CorridorCells[idx].CellBorderThickness = new Thickness(t.Left, t.Top, Math.Max(t.Right, thickness), t.Bottom);
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

    private async Task HandleCorridorCellActivatedAsync(CorridorCellViewModel cell)
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
            if (_selectedCorridorPawnCell == cell)
            {
                cell.IsSelectedPawn = false;
                _selectedCorridorPawnCell = null;
                MessageReceived?.Invoke("Pion reposé.");
                return;
            }

            if (_selectedCorridorPawnCell != null)
            {
                _selectedCorridorPawnCell.IsSelectedPawn = false;
            }

            cell.IsSelectedPawn = true;
            _selectedCorridorPawnCell = cell;
            MessageReceived?.Invoke("Pion pris.");
            return;
        }

        if (_selectedCorridorPawnCell != null)
        {
            if (!cell.IsLegalMove) return;
            await TrySendCorridorMoveAsync(cell.X, cell.Y).ConfigureAwait(true);
            _selectedCorridorPawnCell.IsSelectedPawn = false;
            _selectedCorridorPawnCell = null;
            MessageReceived?.Invoke("Déplacement envoyé.");
            return;
        }

        // Pas de pion en main : proposer pose de mur si possible.
        if (!cell.CanPlaceWallH && !cell.CanPlaceWallV)
        {
            return;
        }

        await PromptAndPlaceWallAsync(cell).ConfigureAwait(true);
    }

    private async Task TrySendCorridorMoveAsync(int x, int y)
    {
        var session = _session;
        if (session == null || !session.IsConnected)
        {
            return;
        }

        var actions = session.LastState?.Actions;
        if (actions == null || actions.Count == 0)
        {
            return;
        }

        var isAvailable = actions.Any(a =>
        {
            if (a == null)
            {
                return false;
            }

            if (!string.Equals(a.Type, "corridor_move", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            try
            {
                if (a.Payload.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }
                if (!a.Payload.TryGetProperty("x", out var xNode) ||
                    !a.Payload.TryGetProperty("y", out var yNode))
                {
                    return false;
                }
                return xNode.TryGetInt32(out var ax) && yNode.TryGetInt32(out var ay) && ax == x && ay == y;
            }
            catch
            {
                return false;
            }
        });

        if (!isAvailable)
        {
            return;
        }

        try
        {
            await session
                .SendActionsAsync(new[] { new GameClientAction("corridor_move", payload: new { x, y }) }, CancellationToken.None)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            try
            {
                await _dialogs.ShowError("Corridor", $"Impossible d'envoyer le déplacement : {ex.Message}").ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
        }
    }

    private async Task PromptAndPlaceWallAsync(CorridorCellViewModel cell)
    {
        if (cell == null)
        {
            return;
        }

        if (cell.CanPlaceWallH && cell.CanPlaceWallV)
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
                await TrySendCorridorPlaceWallAsync(cell.X, cell.Y, "h").ConfigureAwait(true);
            }
            else if (choice == DialogChoice.Secondary)
            {
                await TrySendCorridorPlaceWallAsync(cell.X, cell.Y, "v").ConfigureAwait(true);
            }

            return;
        }

        if (cell.CanPlaceWallH)
        {
            var ok = await _dialogs.Confirm("Mur", $"Poser un mur horizontal à colonne {cell.Column}, ligne {cell.Row} ?", okText: "Poser", cancelText: "Annuler")
                .ConfigureAwait(true);
            if (ok == true)
            {
                await TrySendCorridorPlaceWallAsync(cell.X, cell.Y, "h").ConfigureAwait(true);
            }
            return;
        }

        if (cell.CanPlaceWallV)
        {
            var ok = await _dialogs.Confirm("Mur", $"Poser un mur vertical à colonne {cell.Column}, ligne {cell.Row} ?", okText: "Poser", cancelText: "Annuler")
                .ConfigureAwait(true);
            if (ok == true)
            {
                await TrySendCorridorPlaceWallAsync(cell.X, cell.Y, "v").ConfigureAwait(true);
            }
        }
    }

    private async Task TrySendCorridorPlaceWallAsync(int x, int y, string orientation)
    {
        var session = _session;
        if (session == null || !session.IsConnected)
        {
            return;
        }

        var actions = session.LastState?.Actions;
        if (actions == null || actions.Count == 0)
        {
            return;
        }

        var o = string.Equals(orientation, "v", StringComparison.OrdinalIgnoreCase) ? "v" : "h";

        var isAvailable = actions.Any(a =>
        {
            if (a == null) return false;
            if (!string.Equals(a.Type, "corridor_place_wall", StringComparison.OrdinalIgnoreCase)) return false;
            try
            {
                if (a.Payload.ValueKind != JsonValueKind.Object) return false;
                if (!a.Payload.TryGetProperty("x", out var xNode) ||
                    !a.Payload.TryGetProperty("y", out var yNode) ||
                    !a.Payload.TryGetProperty("o", out var oNode))
                {
                    return false;
                }

                if (!xNode.TryGetInt32(out var ax) || !yNode.TryGetInt32(out var ay)) return false;
                var ao = oNode.ValueKind == JsonValueKind.String ? (oNode.GetString() ?? "") : "";
                return ax == x && ay == y && string.Equals(ao, o, StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        });

        if (!isAvailable)
        {
            return;
        }

        try
        {
            await session
                .SendActionsAsync(new[] { new GameClientAction("corridor_place_wall", payload: new { x, y, o }) }, CancellationToken.None)
                .ConfigureAwait(false);
            MessageReceived?.Invoke("Mur envoyé.");
        }
        catch (Exception ex)
        {
            try
            {
                await _dialogs.ShowError("Corridor", $"Impossible d'envoyer le mur : {ex.Message}").ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
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
