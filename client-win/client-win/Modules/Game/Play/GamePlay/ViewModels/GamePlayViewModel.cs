using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Core.Input;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.Play.Announcements.Services;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Actions.Services;
using client_win.Modules.Game.Play.Choices.Services;
using client_win.Modules.Game.Play.Choices.ViewModels;
using client_win.Modules.Game.Play.GamePlay.Services;
using client_win.Modules.Game.Play.Grid.ViewModels;
using client_win.Modules.Game.Play.Panels.Services;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.Shortcuts.ViewModels;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;
using client_win.Modules.Shell.Services;
using Serilog;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel : ObservableObject, IAsyncDisposable
{
    private readonly Dispatcher _dispatcher;
    private readonly IDialogService _dialogs;
    private readonly Func<CancellationToken, Task<GameSession>> _connect;
    private readonly GamePlayActionDispatcher _actions = new();
    private readonly GamePlayStateProjector _projector = new();
    private readonly GamePlayPanelRequester _panels = new();
    private readonly GamePlayStatePresenter _presenter;
    private readonly GamePlayAnnouncementRouter _announcementRouter;
    private readonly GamePlayEndgameSoundPlayer _endgameSounds;
    private readonly GamePlayChoicesViewModel _choices;
    private readonly PropertyChangedEventHandler _choicesPropertyChangedHandler;
    private readonly GamePlayShortcutsViewModel _shortcuts;
    private readonly GamePlayRealtimeController _realtime;
    private readonly GamePlayConnectionController _connection;
    private readonly GamePlayCommands _commands;

    private GameSession? _session;
    private bool _isSpectator;

    private string _connectionStatus = "Connexion au moteur de jeu...";
    private string _stateSummary = "En attente d'un état de jeu (game.state)...";
    private string _pendingText = string.Empty;
    private string _actionsText = string.Empty;
    private string _boardText = string.Empty;
    private bool _isBotThinking;

    public string GameId { get; }

    public GridBoardViewModel Grid { get; }

    public bool ShowLegacyActionsPanel => !Grid.IsVisible;

    public GamePlayViewModel(
        string gameId,
        Func<CancellationToken, Task<GameSession>> connect,
        IDialogService dialogs,
        ISoundService sounds)
    {
        GameId = (gameId ?? string.Empty).Trim();
        _connect = connect ?? throw new ArgumentNullException(nameof(connect));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        _endgameSounds = new GamePlayEndgameSoundPlayer(sounds ?? throw new ArgumentNullException(nameof(sounds)));
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

        Grid = new GridBoardViewModel(
            dialogs: _dialogs,
            sounds: sounds ?? throw new ArgumentNullException(nameof(sounds)),
            getSession: () => _session,
            canInteract: () => !_isSpectator,
            announce: msg => MessageReceived?.Invoke(msg));
        Grid.PropertyChanged += (_, e) =>
        {
            if (string.Equals(e.PropertyName, nameof(GridBoardViewModel.IsVisible), StringComparison.Ordinal))
            {
                OnPropertyChanged(nameof(ShowLegacyActionsPanel));
                RefreshCanExecute();
            }
        };

        _commands = new GamePlayCommands(
            getSession: () => _session,
            isSpectator: () => _isSpectator,
            actions: _actions,
            choices: _choices,
            canStartAskCardSelection: CanStartAskCardSelection,
            requestTurnAsync: RequestTurnAsync,
            emitMessage: msg => MessageReceived?.Invoke(msg));

        _shortcuts = new GamePlayShortcutsViewModel(_commands.SendKey);

	        _realtime = new GamePlayRealtimeController(
	            dispatcher: _dispatcher,
	            panels: _panels,
	            projector: _projector,
	            presenter: _presenter,
	            announcementRouter: _announcementRouter,
	            endgameSounds: _endgameSounds,
	            choices: _choices,
	            grid: Grid,
	            syncShortcuts: SyncShortcuts,
	            canStartAskCardSelection: CanStartAskCardSelection,
	            emitMessage: msg => MessageReceived?.Invoke(msg),
	            requestFocus: () => GameZoneFocusRequested?.Invoke(),
	            refreshCanExecute: RefreshCanExecute,
	            onGameStatusChanged: OnGameStatusChanged,
	            setIsBotThinking: v => IsBotThinking = v,
	            setStateSummary: v => StateSummary = v,
	            setPendingText: v => PendingText = v,
	            setActionsText: v => ActionsText = v,
	            setBoardText: v => BoardText = v);

        _connection = new GamePlayConnectionController(
            _dispatcher,
            _connect,
            getSession: () => _session,
            setSession: s => _session = s,
            bindSession: s =>
            {
                s.StateUpdated += _realtime.HandleStateUpdated;
                s.TurnUpdated += _realtime.HandleTurnUpdated;
                s.ErrorReceived += OnServerError;
                s.CommandAckReceived += OnCommandAckReceived;
                s.UiMessageReceived += OnUiMessageReceived;
            },
            unbindSession: s =>
            {
                s.StateUpdated -= _realtime.HandleStateUpdated;
                s.TurnUpdated -= _realtime.HandleTurnUpdated;
                s.ErrorReceived -= OnServerError;
                s.CommandAckReceived -= OnCommandAckReceived;
                s.UiMessageReceived -= OnUiMessageReceived;
            },
            setConnectionStatus: status => ConnectionStatus = status,
            refreshCanExecute: RefreshCanExecute);
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

    public string BoardText
    {
        get => _boardText;
        private set => SetProperty(ref _boardText, value);
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
        _realtime.ResetForInitialize();
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

    public Task TrySendKeyAsync(string key, CancellationToken cancellationToken = default)
    {
        var session = _session;
        if (session == null)
        {
            return Task.CompletedTask;
        }

        if (_isSpectator || string.IsNullOrWhiteSpace(key))
        {
            return Task.CompletedTask;
        }

        return session.SendKeyAsync(key, cancellationToken);
    }

	    public Task RequestTurnInfoAsync() => RequestTurnAsync();

	    private void OnGameStatusChanged(string previousStatus, string nextStatus)
	    {
	        if (string.IsNullOrWhiteSpace(nextStatus))
	        {
	            return;
	        }

	        var message = (previousStatus ?? string.Empty).Trim().Length == 0
	            ? $"Statut de la partie : {nextStatus}"
	            : $"Statut de la partie : {previousStatus} -> {nextStatus}";

	        MessageReceived?.Invoke(message);
	    }

	    public async ValueTask DisposeAsync()
	    {
	        _choices.PropertyChanged -= _choicesPropertyChangedHandler;
	        await _connection.DisposeAsync().ConfigureAwait(false);
	    }
}
