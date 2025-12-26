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

    private string _connectionStatus = "Connexion au moteur de jeu...";
    private string _stateSummary = "En attente d'un état de jeu (game.state)...";
    private string _pendingText = string.Empty;
    private string _actionsText = string.Empty;
    private bool _isBotThinking;
    private string? _selectedChoice;

    private readonly AsyncRelayCommand _rollCommand;
    private readonly AsyncRelayCommand _exchangeAcceptCommand;
    private readonly AsyncRelayCommand _exchangeRefuseCommand;
    private readonly AsyncRelayCommand _toggleShoppingCommand;
    private readonly AsyncRelayCommand _toggleBasketCommand;
    private readonly AsyncRelayCommand _toggleInventoryCommand;

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
                _announcements?.ShortcutKey("Entrée");
                await TrySendRollAsync().ConfigureAwait(true);
            },
            canExecute: () => _actions.CanSendRoll(_session));

        _exchangeAcceptCommand = new AsyncRelayCommand(
            async () =>
            {
                _announcements?.ShortcutKey("a");
                await TrySendSimpleActionAsync("exchange_accept").ConfigureAwait(true);
            },
            canExecute: () => _actions.CanSendSimpleAction(_session, "exchange_accept"));

        _exchangeRefuseCommand = new AsyncRelayCommand(
            async () =>
            {
                _announcements?.ShortcutKey("r");
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
            _session.ErrorReceived += OnServerError;
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

        try
        {
            var choice = SelectedChoice;
            if (string.IsNullOrWhiteSpace(choice))
            {
                return false;
            }

            if (!_actions.CanSendAnswer(session, choice))
            {
                return false;
            }

            _announcements?.ShortcutKey("Entrée");
            await _actions.SendAnswerQuizAsync(session, choice, cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de l'envoi de answer_quiz");
            ConnectionStatus = $"Erreur quiz: {ex.Message}";
            _announcements?.Error(ex.Message);
            MessageReceived?.Invoke($"Erreur quiz: {ex.Message}");
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
            TaskScheduler.FromCurrentSynchronizationContext());
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
    }

    private void OnServerError(string message)
    {
        _dispatcher.InvokeAsync(() =>
        {
            ConnectionStatus = $"Erreur serveur: {message}";
            _announcements?.Error(message);
            MessageReceived?.Invoke($"Erreur: {message}");
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
        PendingChoices.Clear();
        SelectedChoice = null;

        var extracted = _projector.ExtractPendingChoices(state);
        foreach (var choice in extracted.choices)
        {
            PendingChoices.Add(choice);
        }
        if (!string.IsNullOrWhiteSpace(extracted.selected) && PendingChoices.Count > 0)
        {
            SelectedChoice = extracted.selected;
        }
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
    }

    public async ValueTask DisposeAsync()
    {
        var session = _session;
        _session = null;
        if (session != null)
        {
            session.StateUpdated -= OnStateUpdated;
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
    }
}

