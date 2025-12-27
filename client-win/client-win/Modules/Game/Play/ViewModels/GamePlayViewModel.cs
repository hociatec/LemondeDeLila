using System;
using System.Collections.ObjectModel;
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

    private GameSession? _session;
    private CancellationTokenSource? _reconnectCts;
    private Task? _reconnectLoop;

    private string _connectionStatus = "Connexion au moteur de jeu...";
    private string _stateSummary = "En attente d'un état de jeu (game.state)...";
    private string _pendingText = string.Empty;
    private string _actionsText = string.Empty;
    private bool _isBotThinking;
    private string? _selectedChoice;
    private int _choiceSubmitInProgress;

    private readonly AsyncRelayCommand _rollCommand;
    private readonly AsyncRelayCommand _exchangeAcceptCommand;
    private readonly AsyncRelayCommand _exchangeRefuseCommand;
    private readonly AsyncRelayCommand _toggleShoppingCommand;
    private readonly AsyncRelayCommand _toggleBasketCommand;
    private readonly AsyncRelayCommand _toggleInventoryCommand;
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

        _rollCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendRollAsync().ConfigureAwait(true);
            },
            canExecute: () => _actions.CanSendRoll(_session));

        _exchangeAcceptCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendSimpleActionAsync("exchange_accept").ConfigureAwait(true);
            },
            canExecute: () => _actions.CanSendSimpleAction(_session, "exchange_accept"));

        _exchangeRefuseCommand = new AsyncRelayCommand(
            async () =>
            {
                await TrySendSimpleActionAsync("exchange_refuse").ConfigureAwait(true);
            },
            canExecute: () => _actions.CanSendSimpleAction(_session, "exchange_refuse"));

        _toggleShoppingCommand = new AsyncRelayCommand(
            () =>
            {
                StartPanelRequest(PanelMode.Shopping);
                return Task.CompletedTask;
            },
            canExecute: () => _projector.HasInterfaceShortcut(_session?.LastState, "shopping"));

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

        _turnInfoCommand = new AsyncRelayCommand(
            RequestTurnAsync,
            canExecute: () => _session != null);

        _positionCommand = new AsyncRelayCommand(
            () =>
            {
                StartPositionRequest();
                return Task.CompletedTask;
            },
            canExecute: () => _session != null);

        BuildStaticShortcuts();
    }

    public ObservableCollection<string> PendingChoices { get; } = new();

    public ObservableCollection<ShortcutDefinition> Shortcuts { get; } = new();

    public event Action<string>? MessageReceived;

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

    public bool IsBotThinking
    {
        get => _isBotThinking;
        private set => SetProperty(ref _isBotThinking, value);
    }

    public string? SelectedChoice
    {
        get => _selectedChoice;
        set => SetProperty(ref _selectedChoice, value);
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        ConnectionStatus = "Connexion au moteur de jeu...";
        try
        {
            _projector.ResetLogCursor();
            _session = await _connect(cancellationToken).ConfigureAwait(false);
            _session.StateUpdated += OnStateUpdated;
            _session.TurnUpdated += OnTurnUpdated;
            _session.ErrorReceived += OnServerError;
            _turnInfoCommand.RaiseCanExecuteChanged();
            ConnectionStatus = "Connecté au moteur de jeu.";
            await _session.RequestStateAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            ConnectionStatus = $"Connexion jeu échouée: {ex.Message}";
        }
    }

    public async Task<bool> SubmitSelectedChoiceAsync(CancellationToken cancellationToken = default)
    {
        var session = _session;
        if (session == null) return false;

        if (Interlocked.Exchange(ref _choiceSubmitInProgress, 1) == 1)
        {
            return false;
        }

        try
        {
            var choice = SelectedChoice;
            if (string.IsNullOrWhiteSpace(choice))
            {
                return false;
            }

            if (!_actions.TryBuildPendingChoiceAction(session, choice, out var action) || action == null)
            {
                return false;
            }

            await session.SendActionsAsync(new[] { action }, cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de l'envoi d'une action de pending");
            ConnectionStatus = $"Erreur pending: {ex.Message}";
            _announcements?.Error(ex.Message);
            MessageReceived?.Invoke($"Erreur pending: {ex.Message}");
            return false;
        }
        finally
        {
            Interlocked.Exchange(ref _choiceSubmitInProgress, 0);
        }
    }

    public async Task TrySendActionAsync(
        string actionType,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        if (_session == null) return;
        if (string.IsNullOrWhiteSpace(actionType)) return;

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
        await _actions.SendRollAsync(session, cancellationToken).ConfigureAwait(false);
    }

    private async Task TrySendSimpleActionAsync(string actionType, CancellationToken cancellationToken = default)
    {
        var session = _session;
        if (session == null) return;
        await _actions.SendSimpleActionAsync(session, actionType, cancellationToken).ConfigureAwait(false);
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
                    Log.Error(t.Exception, "Erreur lors de la demande de panel (Shopping/Basket/Inventory)");
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
            's',
            _toggleShoppingCommand,
            description: "Annoncer shopping list",
            code: "ui.shopping",
            availableInGame: true));

        Shortcuts.Add(new ShortcutDefinition(
            'b',
            _toggleBasketCommand,
            description: "Annoncer panier",
            code: "ui.basket",
            availableInGame: true));

        Shortcuts.Add(new ShortcutDefinition(
            'i',
            _toggleInventoryCommand,
            description: "Annoncer inventaire",
            code: "ui.inventory",
            availableInGame: true));

        Shortcuts.Add(new ShortcutDefinition(
            't',
            _turnInfoCommand,
            description: "A qui est le tour ?",
            code: "ui.turn",
            availableInGame: true));

        Shortcuts.Add(new ShortcutDefinition(
            'p',
            _positionCommand,
            description: "Position + tour",
            code: "ui.position",
            availableInGame: true));
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

        if (LooksLikeDisconnect(message))
        {
            StartReconnectLoop();
        }
    }

    private async Task RequestTurnAsync()
    {
        var session = _session;
        if (session == null) return;
        try
        {
            await session.RequestTurnAsync().ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de la demande de game.turn");
        }
    }

    private void OnTurnUpdated(TurnInfoDto info)
    {
        _dispatcher.InvokeAsync(() =>
        {
            var who = string.IsNullOrWhiteSpace(info.CurrentPlayerUsername) ? null : info.CurrentPlayerUsername.Trim();
            var msg = who == null
                ? "Tour actuel: inconnu."
                : $"C'est au tour de {who}.";

            MessageReceived?.Invoke(msg);
        }, DispatcherPriority.Background);
    }

    private void OnStateUpdated(GameStateDto state)
    {
        _panels.OnStateUpdated(state);

        _dispatcher.InvokeAsync(() =>
        {
            UpdateComputedFields(state);
            UpdatePendingChoices(state);
            RefreshCanExecute();
            EmitNewLogEntries(state);
        }, DispatcherPriority.Background);
    }

    private void UpdateComputedFields(GameStateDto state)
    {
        IsBotThinking = state.BotThinking;
        StateSummary = GamePlayStateSummaryBuilder.Build(state);
        PendingText = GamePlayPendingTextBuilder.Build(state.Pending);
        ActionsText = GamePlayActionsTextBuilder.Build(state);
    }

    private void UpdatePendingChoices(GameStateDto state)
    {
        var extracted = _projector.ExtractPendingChoices(state);
        if (AreSameChoices(PendingChoices, extracted.choices))
        {
            if (PendingChoices.Count > 0 && string.IsNullOrWhiteSpace(SelectedChoice))
            {
                SelectedChoice = extracted.selected;
            }
            return;
        }

        PendingChoices.Clear();
        foreach (var choice in extracted.choices)
        {
            PendingChoices.Add(choice);
        }

        SelectedChoice = PendingChoices.Count > 0 ? extracted.selected : null;
    }

    private static bool AreSameChoices(ObservableCollection<string> existing, System.Collections.Generic.IReadOnlyList<string> next)
    {
        if (existing.Count != next.Count)
        {
            return false;
        }

        for (var i = 0; i < existing.Count; i++)
        {
            if (!string.Equals(existing[i], next[i], StringComparison.Ordinal))
            {
                return false;
            }
        }

        return true;
    }

    private void EmitNewLogEntries(GameStateDto state)
    {
        foreach (var msg in _projector.ExtractNewLogMessages(state))
        {
            MessageReceived?.Invoke(msg);
        }
    }


    private void RefreshCanExecute()
    {
        _rollCommand.RaiseCanExecuteChanged();
        _exchangeAcceptCommand.RaiseCanExecuteChanged();
        _exchangeRefuseCommand.RaiseCanExecuteChanged();
        _toggleShoppingCommand.RaiseCanExecuteChanged();
        _toggleBasketCommand.RaiseCanExecuteChanged();
        _toggleInventoryCommand.RaiseCanExecuteChanged();
        _turnInfoCommand.RaiseCanExecuteChanged();
        _positionCommand.RaiseCanExecuteChanged();
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            _reconnectCts?.Cancel();
        }
        catch
        {
            // ignore
        }

        var session = _session;
        _session = null;
        if (session != null)
        {
            session.StateUpdated -= OnStateUpdated;
            session.TurnUpdated -= OnTurnUpdated;
            session.ErrorReceived -= OnServerError;
            try
            {
                await session.CloseAsync().ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
            await session.DisposeAsync().ConfigureAwait(false);
        }

        if (_reconnectCts != null)
        {
            _reconnectCts.Dispose();
            _reconnectCts = null;
        }
    }

    private static bool LooksLikeDisconnect(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        var m = message.Trim();
        return m.Contains("Connexion jeu perdue", StringComparison.OrdinalIgnoreCase) ||
               m.Contains("WebSocket", StringComparison.OrdinalIgnoreCase) ||
               m.Contains("closed the WebSocket connection", StringComparison.OrdinalIgnoreCase);
    }

    private void StartReconnectLoop()
    {
        if (_reconnectLoop != null && !_reconnectLoop.IsCompleted)
        {
            return;
        }

        _reconnectCts?.Cancel();
        _reconnectCts?.Dispose();
        _reconnectCts = new CancellationTokenSource();

        _reconnectLoop = Task.Run(() => ReconnectLoopAsync(_reconnectCts.Token));
    }

    private async Task ReconnectLoopAsync(CancellationToken cancellationToken)
    {
        var attempt = 0;
        while (!cancellationToken.IsCancellationRequested)
        {
            attempt++;

            await _dispatcher.InvokeAsync(() =>
            {
                ConnectionStatus = $"Reconnexion au moteur de jeu... (tentative {attempt})";
                RefreshCanExecute();
            }, DispatcherPriority.Background);

            try
            {
                var old = _session;
                _session = null;
                if (old != null)
                {
                    old.StateUpdated -= OnStateUpdated;
                    old.TurnUpdated -= OnTurnUpdated;
                    old.ErrorReceived -= OnServerError;
                    try
                    {
                        await old.CloseAsync().ConfigureAwait(false);
                    }
                    catch
                    {
                        // ignore
                    }
                    await old.DisposeAsync().ConfigureAwait(false);
                }

                using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                connectCts.CancelAfter(TimeSpan.FromSeconds(10));

                var session = await _connect(connectCts.Token).ConfigureAwait(false);
                session.StateUpdated += OnStateUpdated;
                session.TurnUpdated += OnTurnUpdated;
                session.ErrorReceived += OnServerError;
                _session = session;

                await session.JoinAsync(connectCts.Token).ConfigureAwait(false);
                await session.RequestStateAsync(connectCts.Token).ConfigureAwait(false);

                await _dispatcher.InvokeAsync(() =>
                {
                    ConnectionStatus = "Reconnecté au moteur de jeu.";
                    RefreshCanExecute();
                }, DispatcherPriority.Background);

                return;
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Reconnexion game WS échouée (tentative {Attempt})", attempt);
            }

            var delayMs = Math.Min(15000, 500 + attempt * 750);
            try
            {
                await Task.Delay(delayMs, cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                return;
            }
        }
    }
}
