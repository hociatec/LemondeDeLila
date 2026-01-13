using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
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
using client_win.Modules.TextPrompts.Services;
using Serilog;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel : ObservableObject, IAsyncDisposable
{
    private readonly Dispatcher _dispatcher;
    private readonly IDialogService _dialogs;
    private readonly ITextPromptService _textPrompts;
    private readonly Func<CancellationToken, Task<GameSession>> _connect;
    private readonly GamePlayActionDispatcher _actions = new();
    private readonly GamePlayStateProjector _projector = new();
    private readonly GamePlayPanelRequester _panels = new();
    private readonly GamePlayStatePresenter _presenter;
    private readonly GamePlayAnnouncementRouter _announcementRouter;
    private readonly GamePlayEndgameSoundPlayer _endgameSounds;
    private readonly GamePlayDiceSoundPlayer _diceSounds;
    private readonly GamePlayChoicesViewModel _choices;
    private readonly PropertyChangedEventHandler _choicesPropertyChangedHandler;
    private readonly NotifyCollectionChangedEventHandler _pendingChoicesChangedHandler;
    private readonly GamePlayShortcutsViewModel _shortcuts;
    private readonly GamePlayRealtimeController _realtime;
    private readonly GamePlayConnectionController _connection;
    private readonly GamePlayCommands _commands;

    private GameSession? _session;
    private bool _isSpectator;
    private int _textPromptInProgress;
    private PendingTextPrompt? _pendingTextPrompt;
    private int _configPromptInProgress;
    private PendingConfigPrompt? _pendingConfigPrompt;

    private string _connectionStatus = "Connexion au moteur de jeu...";
    private string _stateSummary = "En attente d'un état de jeu (game.state)...";
    private string _pendingText = string.Empty;
    private string _actionsText = string.Empty;
    private string _boardText = string.Empty;
    private bool _isBotThinking;

    public string GameId { get; }

    public GridBoardViewModel Grid { get; }

    public bool ShowLegacyActionsPanel => !Grid.IsVisible || (PendingChoices?.Count ?? 0) > 0;

    public GamePlayViewModel(
        string gameId,
        Func<CancellationToken, Task<GameSession>> connect,
        IDialogService dialogs,
        ITextPromptService textPrompts,
        ISoundService sounds)
    {
        GameId = (gameId ?? string.Empty).Trim();
        _connect = connect ?? throw new ArgumentNullException(nameof(connect));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _textPrompts = textPrompts ?? throw new ArgumentNullException(nameof(textPrompts));
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        _endgameSounds = new GamePlayEndgameSoundPlayer(sounds ?? throw new ArgumentNullException(nameof(sounds)));
        _diceSounds = new GamePlayDiceSoundPlayer(sounds ?? throw new ArgumentNullException(nameof(sounds)));
        _choices = new GamePlayChoicesViewModel(_actions);
        _choicesPropertyChangedHandler = (_, e) =>
        {
            if (string.Equals(e.PropertyName, nameof(GamePlayChoicesViewModel.ChoicesLabel), StringComparison.Ordinal))
            {
                OnPropertyChanged(nameof(ChoicesLabel));
            }
        };
        _choices.PropertyChanged += _choicesPropertyChangedHandler;
        _pendingChoicesChangedHandler = (_, __) => OnPropertyChanged(nameof(ShowLegacyActionsPanel));
        _choices.PendingChoices.CollectionChanged += _pendingChoicesChangedHandler;

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
	            diceSounds: _diceSounds,
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
                s.StateUpdated += OnStateUpdated;
                s.TurnUpdated += _realtime.HandleTurnUpdated;
                s.ErrorReceived += OnServerError;
                s.CommandAckReceived += OnCommandAckReceived;
                s.UiMessageReceived += OnUiMessageReceived;
            },
            unbindSession: s =>
            {
                s.StateUpdated -= OnStateUpdated;
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
    public event Action<string, string>? GameStatusChanged;

    public bool HasPendingTextPrompt => _pendingTextPrompt != null;
    public bool HasPendingConfigPrompt => _pendingConfigPrompt != null;

    public async Task<bool> TryOpenPendingTextPromptAsync(CancellationToken cancellationToken = default)
    {
        if (_isSpectator) return false;
        var session = _session;
        if (session == null) return false;
        if (!session.IsConnected) return false;

        var prompt = _pendingTextPrompt;
        if (prompt == null) return false;

        if (Interlocked.Exchange(ref _textPromptInProgress, 1) == 1)
        {
            return false;
        }

        try
        {
            while (true)
            {
                var text = await _textPrompts
                    .PromptAsync(prompt.Title, prompt.Label, prompt.InitialText)
                    .ConfigureAwait(true);

                if (text == null)
                {
                    return false;
                }

                if (string.Equals(prompt.Kind, "number", StringComparison.OrdinalIgnoreCase))
                {
                    if (!int.TryParse(text.Trim(), out var value))
                    {
                        await _dialogs.ShowError("Configuration", "Veuillez entrer un nombre.").ConfigureAwait(true);
                        continue;
                    }
                    if (prompt.Min.HasValue && value < prompt.Min.Value)
                    {
                        await _dialogs.ShowError("Configuration", $"Valeur minimale : {prompt.Min.Value}.").ConfigureAwait(true);
                        continue;
                    }
                    if (prompt.Max.HasValue && value > prompt.Max.Value)
                    {
                        await _dialogs.ShowError("Configuration", $"Valeur maximale : {prompt.Max.Value}.").ConfigureAwait(true);
                        continue;
                    }

                    var payload = new System.Collections.Generic.Dictionary<string, object>
                    {
                        [prompt.PayloadKey] = value
                    };
                    await session
                        .SendActionsAsync(new[] { new GameClientAction(prompt.ActionType, payload) }, cancellationToken)
                        .ConfigureAwait(false);
                    return true;
                }

                var payloadText = new System.Collections.Generic.Dictionary<string, object>
                {
                    [prompt.PayloadKey] = text.Trim()
                };
                await session
                    .SendActionsAsync(new[] { new GameClientAction(prompt.ActionType, payloadText) }, cancellationToken)
                    .ConfigureAwait(false);
                return true;
            }
        }
        finally
        {
            Interlocked.Exchange(ref _textPromptInProgress, 0);
        }
    }

    public async Task<bool> TryOpenPendingConfigPromptAsync(CancellationToken cancellationToken = default)
    {
        if (_isSpectator) return false;
        var session = _session;
        if (session == null) return false;
        if (!session.IsConnected) return false;

        var prompt = _pendingConfigPrompt;
        if (prompt == null) return false;

        if (Interlocked.Exchange(ref _configPromptInProgress, 1) == 1)
        {
            return false;
        }

        try
        {
            var fields = prompt.Fields
                .Select(f => (f.Key, f.Label, f.InitialText, f.Kind))
                .ToList();

            var values = await _textPrompts.PromptConfigAsync(prompt.Title, fields).ConfigureAwait(true);
            if (values == null)
            {
                return false;
            }

            var payload = new System.Collections.Generic.Dictionary<string, object>(StringComparer.Ordinal);
            foreach (var field in prompt.Fields)
            {
                if (!values.TryGetValue(field.Key, out var text))
                {
                    await _dialogs.ShowError("Configuration", $"Champ manquant : {field.Label}.").ConfigureAwait(true);
                    return false;
                }

                if (string.Equals(field.Kind, "number", StringComparison.OrdinalIgnoreCase))
                {
                    if (!int.TryParse((text ?? string.Empty).Trim(), out var value))
                    {
                        await _dialogs.ShowError("Configuration", $"Veuillez entrer un nombre pour : {field.Label}.").ConfigureAwait(true);
                        return false;
                    }
                    if (field.Min.HasValue && value < field.Min.Value)
                    {
                        await _dialogs.ShowError("Configuration", $"Valeur minimale pour {field.Label} : {field.Min.Value}.").ConfigureAwait(true);
                        return false;
                    }
                    if (field.Max.HasValue && value > field.Max.Value)
                    {
                        await _dialogs.ShowError("Configuration", $"Valeur maximale pour {field.Label} : {field.Max.Value}.").ConfigureAwait(true);
                        return false;
                    }
                    payload[field.Key] = value;
                }
                else if (string.Equals(field.Kind, "bool", StringComparison.OrdinalIgnoreCase) ||
                         string.Equals(field.Kind, "boolean", StringComparison.OrdinalIgnoreCase))
                {
                    if (!TryParseBool(text, out var value))
                    {
                        await _dialogs.ShowError("Configuration", $"Veuillez cocher/décocher : {field.Label}.").ConfigureAwait(true);
                        return false;
                    }
                    payload[field.Key] = value;
                }
                else
                {
                    payload[field.Key] = (text ?? string.Empty).Trim();
                }
            }

            await session
                .SendActionsAsync(new[] { new GameClientAction(prompt.ActionType, payload) }, cancellationToken)
                .ConfigureAwait(false);
            return true;
        }
        finally
        {
            Interlocked.Exchange(ref _configPromptInProgress, 0);
        }
    }

    private static bool TryParseBool(string? text, out bool value)
    {
        var t = (text ?? string.Empty).Trim();
        if (bool.TryParse(t, out value))
        {
            return true;
        }

        switch (t.ToLowerInvariant())
        {
            case "1":
            case "oui":
            case "yes":
            case "on":
                value = true;
                return true;
            case "0":
            case "non":
            case "no":
            case "off":
                value = false;
                return true;
        }

        value = false;
        return false;
    }

    public void SetSpectator(bool isSpectator)
    {
        if (_isSpectator == isSpectator)
        {
            return;
        }

        _isSpectator = isSpectator;
        RefreshCanExecute();
    }

    private void OnStateUpdated(GameStateDto state)
    {
        _realtime.HandleStateUpdated(state);

        _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            UpdatePendingTextPrompt(state);
            OnPropertyChanged(nameof(HasPendingTextPrompt));
            UpdatePendingConfigPrompt(state);
            OnPropertyChanged(nameof(HasPendingConfigPrompt));

            // Best-effort: automatically open the prompt when it appears.
            if (_pendingTextPrompt != null)
            {
                _ = TryOpenPendingTextPromptAsync();
            }
            if (_pendingConfigPrompt != null)
            {
                _ = TryOpenPendingConfigPromptAsync();
            }
        }));
    }

    private void UpdatePendingTextPrompt(GameStateDto state)
    {
        var pending = state.Pending;
        if (pending == null || !string.Equals(pending.Type?.Trim(), "text_prompt", StringComparison.OrdinalIgnoreCase))
        {
            _pendingTextPrompt = null;
            return;
        }

        // Only the targeted player should be prompted.
        var viewerId = GamePlayExtrasParser.ExtractViewerPlayerId(state);
        if (pending.PlayerId.HasValue && viewerId.HasValue && pending.PlayerId.Value != viewerId.Value)
        {
            _pendingTextPrompt = null;
            return;
        }

        var label = !string.IsNullOrWhiteSpace(pending.Label)
            ? pending.Label!.Trim()
            : !string.IsNullOrWhiteSpace(pending.Question)
                ? pending.Question!.Trim()
                : "Saisie requise";

        if (pending.Data.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            _pendingTextPrompt = null;
            return;
        }

        static string? GetString(System.Text.Json.JsonElement obj, string prop) =>
            obj.TryGetProperty(prop, out var el) && el.ValueKind == System.Text.Json.JsonValueKind.String
                ? el.GetString()
                : null;

        static int? GetInt(System.Text.Json.JsonElement obj, string prop)
        {
            if (!obj.TryGetProperty(prop, out var el)) return null;
            if (el.ValueKind == System.Text.Json.JsonValueKind.Number && el.TryGetInt32(out var i)) return i;
            if (el.ValueKind == System.Text.Json.JsonValueKind.String && int.TryParse(el.GetString(), out var s)) return s;
            return null;
        }

        var data = pending.Data;
        var actionType = (GetString(data, "actionType") ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(actionType))
        {
            _pendingTextPrompt = null;
            return;
        }

        _pendingTextPrompt = new PendingTextPrompt(
            Title: (GetString(data, "title") ?? "Configuration").Trim(),
            Label: label,
            InitialText: GetString(data, "initialText") ?? string.Empty,
            ActionType: actionType,
            PayloadKey: (GetString(data, "payloadKey") ?? "value").Trim(),
            Kind: (GetString(data, "kind") ?? "text").Trim(),
            Min: GetInt(data, "min"),
            Max: GetInt(data, "max"));
    }

    private sealed record PendingTextPrompt(
        string Title,
        string Label,
        string InitialText,
        string ActionType,
        string PayloadKey,
        string Kind,
        int? Min,
        int? Max);

    private void UpdatePendingConfigPrompt(GameStateDto state)
    {
        var pending = state.Pending;
        if (pending == null || !string.Equals(pending.Type?.Trim(), "config_prompt", StringComparison.OrdinalIgnoreCase))
        {
            _pendingConfigPrompt = null;
            return;
        }

        var viewerId = GamePlayExtrasParser.ExtractViewerPlayerId(state);
        if (pending.PlayerId.HasValue && viewerId.HasValue && pending.PlayerId.Value != viewerId.Value)
        {
            _pendingConfigPrompt = null;
            return;
        }

        if (pending.Data.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            _pendingConfigPrompt = null;
            return;
        }

        static string? GetString(System.Text.Json.JsonElement obj, string prop) =>
            obj.TryGetProperty(prop, out var el) && el.ValueKind == System.Text.Json.JsonValueKind.String
                ? el.GetString()
                : null;

        static int? GetInt(System.Text.Json.JsonElement obj, string prop)
        {
            if (!obj.TryGetProperty(prop, out var el)) return null;
            if (el.ValueKind == System.Text.Json.JsonValueKind.Number && el.TryGetInt32(out var i)) return i;
            if (el.ValueKind == System.Text.Json.JsonValueKind.String && int.TryParse(el.GetString(), out var s)) return s;
            return null;
        }

        var data = pending.Data;
        var actionType = (GetString(data, "actionType") ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(actionType))
        {
            _pendingConfigPrompt = null;
            return;
        }

        if (!data.TryGetProperty("fields", out var fieldsEl) ||
            fieldsEl.ValueKind != System.Text.Json.JsonValueKind.Array)
        {
            _pendingConfigPrompt = null;
            return;
        }

        var fields = new System.Collections.Generic.List<PendingConfigField>();
        foreach (var field in fieldsEl.EnumerateArray())
        {
            if (field.ValueKind != System.Text.Json.JsonValueKind.Object) continue;
            var key = (GetString(field, "key") ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(key)) continue;
            fields.Add(new PendingConfigField(
                Key: key,
                Label: (GetString(field, "label") ?? key).Trim(),
                InitialText: GetString(field, "initialText") ?? string.Empty,
                Kind: (GetString(field, "kind") ?? "text").Trim(),
                Min: GetInt(field, "min"),
                Max: GetInt(field, "max")));
        }

        if (fields.Count == 0)
        {
            _pendingConfigPrompt = null;
            return;
        }

        _pendingConfigPrompt = new PendingConfigPrompt(
            Title: (GetString(data, "title") ?? "Configuration").Trim(),
            ActionType: actionType,
            Fields: fields);
    }

    private sealed record PendingConfigPrompt(
        string Title,
        string ActionType,
        System.Collections.Generic.IReadOnlyList<PendingConfigField> Fields);

    private sealed record PendingConfigField(
        string Key,
        string Label,
        string InitialText,
        string Kind,
        int? Min,
        int? Max);

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

    public int SelectedChoiceIndex
    {
        get => _choices.SelectedChoiceIndex;
        set
        {
            if (_choices.SelectedChoiceIndex == value)
            {
                return;
            }

            _choices.SelectedChoiceIndex = value;
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

    public bool TryHandleInterfaceShortcutLocally(string normalizedKey)
    {
        var session = _session;
        if (session?.LastState == null)
        {
            return false;
        }

        var state = session.LastState;
        if (string.IsNullOrWhiteSpace(normalizedKey))
        {
            return false;
        }

        var pressed = normalizedKey.Trim().ToUpperInvariant();
        var hints = GamePlayExtrasParser.ExtractShortcutHints(state);
        foreach (var hint in hints)
        {
            if (!string.Equals(hint.Type, "interface", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var raw = hint.Key ?? string.Empty;
            const string prefix = "pressed ";
            if (raw.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                raw = raw.Substring(prefix.Length);
            }
            var key = raw.Trim().ToUpperInvariant();
            if (!string.Equals(key, pressed, StringComparison.Ordinal))
            {
                continue;
            }

            var panelId = hint.Id ?? string.Empty;
            if (string.IsNullOrWhiteSpace(panelId))
            {
                continue;
            }

            if (GamePlayUiPanelsParser.TryGetPanelMessage(state, panelId.Trim(), out var message) &&
                !string.IsNullOrWhiteSpace(message))
            {
                MessageReceived?.Invoke(message.Trim());
                return true;
            }
        }

        return false;
    }

	    public Task RequestTurnInfoAsync() => RequestTurnAsync();

	    private void OnGameStatusChanged(string previousStatus, string nextStatus)
	    {
	        if (string.IsNullOrWhiteSpace(nextStatus))
	        {
	            return;
	        }
	        GameStatusChanged?.Invoke(previousStatus ?? string.Empty, nextStatus);
	    }

	    public async ValueTask DisposeAsync()
	    {
            try
            {
                _choices.PendingChoices.CollectionChanged -= _pendingChoicesChangedHandler;
            }
            catch
            {
                // ignore
            }

	        _choices.PropertyChanged -= _choicesPropertyChangedHandler;
	        await _connection.DisposeAsync().ConfigureAwait(false);
	    }
}
