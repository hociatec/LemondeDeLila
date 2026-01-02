using System;
using System.Collections.ObjectModel;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core;
using client_win.Core.Input;
using client_win.Modules.Game.Play.Dtos;
using client_win.Modules.Game.Play.Services;
using client_win.Modules.Shell.Services;
using Serilog;

namespace client_win.Modules.Game.Play.ViewModels;

public sealed class GamePlayViewModel : ObservableObject, IAsyncDisposable
{
    private readonly Dispatcher _dispatcher;
    private readonly IDialogService _dialogs;
    private readonly Func<CancellationToken, Task<GameSession>> _connect;
    private readonly IGameAnnouncements? _announcements;
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

    private GameSession? _session;

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

    public GamePlayViewModel(
        Func<CancellationToken, Task<GameSession>> connect,
        IDialogService dialogs,
        IGameAnnouncements? announcements = null)
    {
        _connect = connect ?? throw new ArgumentNullException(nameof(connect));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _announcements = announcements;
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
        _announcementRouter = new GamePlayAnnouncementRouter(_announcements);

        _rollCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendRollAsync().ConfigureAwait(true);
            },
            canExecute: () => _actions.CanSendRoll(_session));

        _exchangeAcceptCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendFirstAvailableSimpleActionAsync("answer_ask_card_accept", "exchange_accept")
                    .ConfigureAwait(true);
            },
            canExecute: () =>
                _actions.CanSendSimpleAction(_session, "answer_ask_card_accept") ||
                _actions.CanSendSimpleAction(_session, "exchange_accept"));

        _exchangeRefuseCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendFirstAvailableSimpleActionAsync("answer_ask_card_refuse", "exchange_refuse")
                    .ConfigureAwait(true);
            },
            canExecute: () =>
                _actions.CanSendSimpleAction(_session, "answer_ask_card_refuse") ||
                _actions.CanSendSimpleAction(_session, "exchange_refuse"));

        _drawCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendSimpleActionAsync("draw").ConfigureAwait(true);
            },
            canExecute: () => _actions.CanSendSimpleAction(_session, "draw"));

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
            canExecute: () => _choices.HasDiscardChoices(_session?.LastState));

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
            canExecute: () => CanStartAskCardSelection(_session?.LastState));

        _pollutionCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Pollution);
                return Task.CompletedTask;
            },
            canExecute: () => HasPollution(_session?.LastState));

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
                !string.IsNullOrWhiteSpace(actionType) &&
                _actions.CanSendSimpleAction(_session, actionType));

        _toggleShoppingCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Shopping);
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "shopping"));

        _toggleStableCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Stable);
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "stable"));

        _toggleScoreCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Score);
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "score"));

        _toggleBasketCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Basket);
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "basket"));

        _toggleInventoryCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Inventory);
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "inventory"));

        _toggleHandCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Hand);
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "hand"));

        _toggleBooksCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Books);
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "books"));

        _turnInfoCommand = new AsyncRelayCommand(
            RequestTurnAsync,
            canExecute: () => _session != null);

        _positionCommand = new AsyncRelayCommand(
            () =>
            {
                StartPositionRequest();
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "position"));

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
        _projector.ResetLogCursor();
        _lastStateTurnPlayerId = null;

        await _connection.InitializeAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<bool> SubmitSelectedChoiceAsync(CancellationToken cancellationToken = default)
    {
        var session = _session;
        if (session == null) return false;

        try
        {
            return await _choices.SubmitSelectedChoiceAsync(
                    session,
                    emitError: message =>
                    {
                        ConnectionStatus = $"Erreur pending: {message}";
                        _announcements?.Error(message);
                        MessageReceived?.Invoke($"Erreur pending: {message}");
                    },
                    cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de l'envoi d'une action de pending");
            ConnectionStatus = $"Erreur pending: {ex.Message}";
            _announcements?.Error(ex.Message);
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
            _announcements?.Error(message);
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

            IsBotThinking = presented.isBotThinking;
            StateSummary = presented.stateSummary;
            PendingText = presented.pendingText;
            ActionsText = presented.actionsText;

            if (state != null)
            {
                _gameShortcuts.Sync(state, CanStartAskCardSelection);
                SyncInterfaceShortcuts(state);
            }

            RefreshCanExecute();

            if (state != null)
            {
                TryAnnounceTurnFromState(state);
            }
        }, DispatcherPriority.Background);
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
        return session.IsConnected;
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
