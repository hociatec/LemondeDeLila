using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Collections.Generic;
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
using client_win.Modules.Game.Play.GamePlay.Dtos;
using client_win.Modules.TextPrompts.Services;
using Serilog;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel : ObservableObject, IAsyncDisposable
{
    public sealed class ChoiceLine
    {
        public ChoiceLine(string text, int? choiceIndex)
        {
            Text = text ?? string.Empty;
            ChoiceIndex = choiceIndex;
        }

        public string Text { get; }

        // Index into PendingChoices (server/local choice list). Null => informational line (quiz question).
        public int? ChoiceIndex { get; }

        public override string ToString() => Text;
    }

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
    private readonly GamePlayLogSoundPlayer _logSounds;
    private readonly GamePlayChoicesViewModel _choices;
    private readonly PropertyChangedEventHandler _choicesPropertyChangedHandler;
    private readonly NotifyCollectionChangedEventHandler _pendingChoicesChangedHandler;
    private readonly GamePlayShortcutsViewModel _shortcuts;
    private readonly GamePlayRealtimeController _realtime;
    private readonly GamePlayConnectionController _connection;
    private readonly GamePlayCommands _commands;

    private readonly object _initializeLock = new();
    private Task? _initializeTask;

    private GameSession? _session;
    private bool _isSpectator;
    private PendingTextPrompt? _pendingTextPrompt;
    private PendingConfigPrompt? _pendingConfigPrompt;
    private int _configPromptInProgress;
    private string _lastConfigPromptSignatureShown = string.Empty;
    private string _inlinePromptTitle = string.Empty;
    private string _inlinePromptActionType = string.Empty;
    private string _inlinePromptCancelActionType = string.Empty;
    private string _inlinePromptSignature = string.Empty;

    private string _connectionStatus = "Connexion au moteur de jeu...";
    private string _stateSummary = "En attente d'un état de jeu (game.state)...";
    private string _pendingText = string.Empty;
    private string _actionsText = string.Empty;
    private string _boardText = string.Empty;
    private bool _isBotThinking;
    private string _pendingType = string.Empty;
    private string _quizQuestionText = string.Empty;
    private string _lastQuizQuestionForSelectionReset = string.Empty;
    private int _selectedDisplayIndex = -1;

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
        _logSounds = new GamePlayLogSoundPlayer(sounds ?? throw new ArgumentNullException(nameof(sounds)));
        _choices = new GamePlayChoicesViewModel(_actions);
        _choicesPropertyChangedHandler = (_, e) =>
        {
            if (string.Equals(e.PropertyName, nameof(GamePlayChoicesViewModel.ChoicesLabel), StringComparison.Ordinal))
            {
                OnPropertyChanged(nameof(ChoicesLabel));
            }
        };
        _choices.PropertyChanged += _choicesPropertyChangedHandler;
        _pendingChoicesChangedHandler = (_, __) =>
        {
            OnPropertyChanged(nameof(ShowLegacyActionsPanel));
            RebuildDisplayChoices();
        };
        _choices.PendingChoices.CollectionChanged += _pendingChoicesChangedHandler;

        _presenter = new GamePlayStatePresenter(_projector);
        _announcementRouter = new GamePlayAnnouncementRouter();

        Grid = new GridBoardViewModel(
            dialogs: _dialogs,
            sounds: sounds ?? throw new ArgumentNullException(nameof(sounds)),
            getSession: () => _session,
            canInteract: () => !_isSpectator,
            announce: msg => MessageReceived?.Invoke(new GamePlayHistoryMessage(msg)));
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
            emitMessage: msg => MessageReceived?.Invoke(new GamePlayHistoryMessage(msg)));

        _shortcuts = new GamePlayShortcutsViewModel(_commands.SendKey);

	        _realtime = new GamePlayRealtimeController(
	            dispatcher: _dispatcher,
	            panels: _panels,
	            projector: _projector,
	            presenter: _presenter,
	            announcementRouter: _announcementRouter,
	            endgameSounds: _endgameSounds,
	            diceSounds: _diceSounds,
                logSounds: _logSounds,
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

        RebuildDisplayChoices();
        InitializeHandSupport();
    }

    public ObservableCollection<string> PendingChoices => _choices.PendingChoices;

    public ObservableCollection<ChoiceLine> DisplayChoices { get; } = new();

    public string ChoicesLabel => _choices.ChoicesLabel;

    public ObservableCollection<ShortcutDefinition> Shortcuts => _shortcuts.Shortcuts;

        public event Action<GamePlayHistoryMessage>? MessageReceived;
    public event Action? GameZoneFocusRequested;
    public event Action<string, string>? GameStatusChanged;

    public bool HasPendingTextPrompt => _pendingTextPrompt != null;
    public bool HasPendingConfigPrompt => _pendingConfigPrompt != null;

    public bool HasInlinePrompt => InlinePromptFields.Count > 0 && !string.IsNullOrWhiteSpace(_inlinePromptActionType);

    public string InlinePromptTitle
    {
        get => _inlinePromptTitle;
        private set => SetProperty(ref _inlinePromptTitle, value);
    }

    public ObservableCollection<InlinePromptFieldModel> InlinePromptFields { get; } = new();

    public string PendingType
    {
        get => _pendingType;
        private set
        {
            if (string.Equals(_pendingType, value, StringComparison.Ordinal))
            {
                return;
            }
            _pendingType = value ?? string.Empty;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsQuizPending));
            RebuildDisplayChoices();
        }
    }

    public bool IsQuizPending =>
        string.Equals((_pendingType ?? string.Empty).Trim(), "quiz", StringComparison.OrdinalIgnoreCase);

    public string QuizQuestionText
    {
        get => _quizQuestionText;
        private set
        {
            if (SetProperty(ref _quizQuestionText, value))
            {
                OnPropertyChanged(nameof(ChoicesA11yName));
                RebuildDisplayChoices();
            }
        }
    }

    // Index used by the UI list (includes the quiz question line at index 0 when present).
    public int SelectedDisplayIndex
    {
        get => _selectedDisplayIndex;
        set
        {
            if (_selectedDisplayIndex == value)
            {
                return;
            }

            _selectedDisplayIndex = value;
            OnPropertyChanged();

            // Map UI index -> underlying choice index.
            if (IsQuizPending && DisplayChoices.Count > 0 && DisplayChoices[0].ChoiceIndex == null)
            {
                SelectedChoiceIndex = value <= 0 ? -1 : value - 1;
            }
            else
            {
                SelectedChoiceIndex = value;
            }
        }
    }

    public string ChoicesA11yName
    {
        get
        {
            var label = (ChoicesLabel ?? string.Empty).Trim();
            return label;
        }
    }

    public async Task<bool> TryOpenPendingTextPromptAsync(CancellationToken cancellationToken = default)
    {
        // Les prompts de jeu ne doivent plus ouvrir de fenêtre modale (ils sont affichés inline dans la vue).
        // Cette méthode est conservée pour compatibilité, mais devient un no-op.
        await Task.CompletedTask;
        return false;
    }

    public async Task<bool> TryOpenPendingConfigPromptAsync(CancellationToken cancellationToken = default)
    {
        if (_isSpectator) return false;
        var session = _session;
        if (session == null) return false;
        if (!session.IsConnected) return false;

        var prompt = _pendingConfigPrompt;
        if (prompt == null) return false;

        var actionType = (prompt.ActionType ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(actionType)) return false;

        var title = (prompt.Title ?? "Configuration").Trim();

        var sig = "config:" + actionType + ":" + title + ":" +
                  string.Join(
                      "|",
                      prompt.Fields.Select(f =>
                          $"{(f.Key ?? string.Empty).Trim()}:{(f.Kind ?? string.Empty).Trim()}:{f.Min?.ToString() ?? ""}:{f.Max?.ToString() ?? ""}:{(f.InitialText ?? string.Empty).Trim()}"));
        if (string.Equals(_lastConfigPromptSignatureShown, sig, StringComparison.Ordinal))
        {
            return false;
        }

        if (Interlocked.Exchange(ref _configPromptInProgress, 1) == 1)
        {
            return false;
        }

        try
        {
            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var fields = prompt.Fields
                    .Select(f => (f.Key, f.Label, f.InitialText, f.Kind))
                    .ToList();

                var values = await _textPrompts.PromptConfigAsync(title, fields).ConfigureAwait(true);
                if (values == null)
                {
                    if (!string.IsNullOrWhiteSpace(prompt.CancelActionType))
                    {
                        _lastConfigPromptSignatureShown = sig;
                        await session
                            .SendActionsAsync(
                                new[] { new GameClientAction(prompt.CancelActionType.Trim(), new Dictionary<string, object>()) },
                                cancellationToken)
                            .ConfigureAwait(false);
                        GameZoneFocusRequested?.Invoke();
                        return true;
                    }

                    // Certains jeux rendent la configuration obligatoire (pas de cancelActionType).
                    // Dans ce cas, on empêche la fermeture silencieuse : on informe et on ré-ouvre.
                    await _dialogs
                        .ShowError("Configuration", "Configuration obligatoire.")
                        .ConfigureAwait(true);
                    continue;
                }

                var payload = new Dictionary<string, object>(StringComparer.Ordinal);
                string? validationError = null;

                foreach (var field in prompt.Fields)
                {
                    if (!values.TryGetValue(field.Key, out var text))
                    {
                        validationError = $"Champ manquant : {field.Label}.";
                        break;
                    }

                    if (string.Equals(field.Kind, "number", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!int.TryParse((text ?? string.Empty).Trim(), out var value))
                        {
                            validationError = $"Veuillez entrer un nombre pour : {field.Label}.";
                            break;
                        }
                        if (field.Min.HasValue && value < field.Min.Value)
                        {
                            validationError = $"Valeur minimale pour {field.Label} : {field.Min.Value}.";
                            break;
                        }
                        if (field.Max.HasValue && value > field.Max.Value)
                        {
                            validationError = $"Valeur maximale pour {field.Label} : {field.Max.Value}.";
                            break;
                        }
                        payload[field.Key] = value;
                    }
                    else if (string.Equals(field.Kind, "bool", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(field.Kind, "boolean", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!TryParseBool(text, out var value))
                        {
                            validationError = $"Veuillez cocher/décocher : {field.Label}.";
                            break;
                        }
                        payload[field.Key] = value;
                    }
                    else
                    {
                        payload[field.Key] = (text ?? string.Empty).Trim();
                    }
                }

                if (!string.IsNullOrWhiteSpace(validationError))
                {
                    await _dialogs.ShowError("Configuration", validationError.Trim()).ConfigureAwait(true);
                    continue;
                }

                _lastConfigPromptSignatureShown = sig;
                await session
                    .SendActionsAsync(new[] { new GameClientAction(actionType, payload) }, cancellationToken)
                    .ConfigureAwait(false);
                GameZoneFocusRequested?.Invoke();
                return true;
            }
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
            SyncHandFromState(state);
            PendingType = (state.Pending?.Type ?? string.Empty).Trim();
            var question = ExtractQuizQuestion(state);
            QuizQuestionText = question;
            ResetQuizSelectionIfNewQuestion(question);

            UpdatePendingTextPrompt(state);
            OnPropertyChanged(nameof(HasPendingTextPrompt));
            UpdatePendingConfigPrompt(state);
            OnPropertyChanged(nameof(HasPendingConfigPrompt));

            // Configuration: ouvrir une boîte de dialogue au lancement (et lors des prompts config_prompt).
            if (HasPendingConfigPrompt)
            {
                _ = TryOpenPendingConfigPromptAsync(CancellationToken.None);
            }

            SyncInlinePromptFromPending();
            OnPropertyChanged(nameof(HasInlinePrompt));
        }));
    }

    private void ResetQuizSelectionIfNewQuestion(string? question)
    {
        if (!IsQuizPending)
        {
            _lastQuizQuestionForSelectionReset = string.Empty;
            return;
        }

        var q = (question ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(q))
        {
            return;
        }

        if (string.Equals(_lastQuizQuestionForSelectionReset, q, StringComparison.Ordinal))
        {
            return;
        }

        _lastQuizQuestionForSelectionReset = q;
        SelectedChoiceIndex = -1;
    }

    private void RebuildDisplayChoices()
    {
        DisplayChoices.Clear();

        if (IsQuizPending)
        {
            var q = (QuizQuestionText ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(q))
            {
                DisplayChoices.Add(new ChoiceLine(q, choiceIndex: null));
            }
        }

        for (var i = 0; i < PendingChoices.Count; i++)
        {
            DisplayChoices.Add(new ChoiceLine(PendingChoices[i], i));
        }

        SyncSelectedDisplayFromChoice();
    }

    private void SyncSelectedDisplayFromChoice()
    {
        var want = SelectedChoiceIndex;
        var hasQuestionLine = IsQuizPending && DisplayChoices.Count > 0 && DisplayChoices[0].ChoiceIndex == null;
        var next = hasQuestionLine ? (want < 0 ? 0 : want + 1) : want;
        if (_selectedDisplayIndex == next)
        {
            return;
        }

        _selectedDisplayIndex = next;
        OnPropertyChanged(nameof(SelectedDisplayIndex));
    }

    private string ExtractQuizQuestion(GameStateDto state)
    {
        try
        {
            var pending = state.Pending;
            if (pending == null)
            {
                return string.Empty;
            }

            if (!string.Equals((pending.Type ?? string.Empty).Trim(), "quiz", StringComparison.OrdinalIgnoreCase))
            {
                return string.Empty;
            }

            var viewerId = GamePlayExtrasParser.ExtractViewerPlayerId(state);
            if (pending.PlayerId.HasValue && viewerId.HasValue && pending.PlayerId.Value != viewerId.Value)
            {
                return string.Empty;
            }

            return (pending.Question ?? string.Empty).Trim();
        }
        catch
        {
            return string.Empty;
        }
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

        var cancelActionType = (GetString(data, "cancelActionType") ?? string.Empty).Trim();
        var title = (GetString(data, "title") ?? "Configuration").Trim();
        var initialText = GetString(data, "initialText") ?? string.Empty;
        var payloadKey = (GetString(data, "payloadKey") ?? "value").Trim();
        var kind = (GetString(data, "kind") ?? "text").Trim();

        _pendingTextPrompt = new PendingTextPrompt(
            Title: title,
            Label: label,
            InitialText: initialText,
            ActionType: actionType,
            PayloadKey: payloadKey,
            CancelActionType: cancelActionType,
            Kind: kind,
            Min: GetInt(data, "min"),
            Max: GetInt(data, "max"));
    }

    private sealed record PendingTextPrompt(
        string Title,
        string Label,
        string InitialText,
        string ActionType,
        string PayloadKey,
        string CancelActionType,
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

        var cancelActionType = (GetString(data, "cancelActionType") ?? string.Empty).Trim();

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
            var label = (GetString(field, "label") ?? key).Trim();
            var initialText = GetString(field, "initialText") ?? string.Empty;
            var kind = (GetString(field, "kind") ?? "text").Trim();
            fields.Add(new PendingConfigField(
                Key: key,
                Label: label,
                InitialText: initialText,
                Kind: kind,
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
            CancelActionType: cancelActionType,
            Fields: fields);
    }

    private sealed record PendingConfigPrompt(
        string Title,
        string ActionType,
        string CancelActionType,
        System.Collections.Generic.IReadOnlyList<PendingConfigField> Fields);

    private sealed record PendingConfigField(
        string Key,
        string Label,
        string InitialText,
        string Kind,
        int? Min,
        int? Max);

    public sealed class InlinePromptFieldModel : ObservableObject
    {
        private string _text = string.Empty;
        private bool _boolValue;

        public InlinePromptFieldModel(string key, string label, string kind, int? min, int? max, string initialText)
        {
            Key = (key ?? string.Empty).Trim();
            Label = string.IsNullOrWhiteSpace(label) ? Key : label.Trim();
            Kind = (kind ?? "text").Trim();
            Min = min;
            Max = max;
            Text = initialText ?? string.Empty;
            BoolValue = ParseBoolOrDefault(initialText, defaultValue: false);
        }

        public string Key { get; }
        public string Label { get; }
        public string Kind { get; }
        public int? Min { get; }
        public int? Max { get; }

        public bool IsBool => string.Equals(Kind, "bool", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(Kind, "boolean", StringComparison.OrdinalIgnoreCase);

        public string Text
        {
            get => _text;
            set => SetProperty(ref _text, value);
        }

        public bool BoolValue
        {
            get => _boolValue;
            set => SetProperty(ref _boolValue, value);
        }

        private static bool ParseBoolOrDefault(string? text, bool defaultValue)
        {
            var t = (text ?? string.Empty).Trim();
            if (t.Length == 0)
            {
                return defaultValue;
            }

            if (bool.TryParse(t, out var b))
            {
                return b;
            }

            return t.ToLowerInvariant() switch
            {
                "1" => true,
                "0" => false,
                "oui" => true,
                "non" => false,
                "yes" => true,
                "no" => false,
                "on" => true,
                "off" => false,
                _ => defaultValue
            };
        }
    }

    private void SyncInlinePromptFromPending()
    {
        try
        {
            if (_pendingTextPrompt != null)
            {
                var sig = "text:" + (_pendingTextPrompt.ActionType ?? string.Empty).Trim() + ":" +
                          (_pendingTextPrompt.PayloadKey ?? string.Empty).Trim();

                _inlinePromptActionType = (_pendingTextPrompt.ActionType ?? string.Empty).Trim();
                _inlinePromptCancelActionType = (_pendingTextPrompt.CancelActionType ?? string.Empty).Trim();
                InlinePromptTitle = (_pendingTextPrompt.Title ?? "Saisie").Trim();

                if (!string.Equals(_inlinePromptSignature, sig, StringComparison.Ordinal))
                {
                    _inlinePromptSignature = sig;
                    InlinePromptFields.Clear();
                    InlinePromptFields.Add(new InlinePromptFieldModel(
                        key: _pendingTextPrompt.PayloadKey ?? "value",
                        label: _pendingTextPrompt.Label,
                        kind: _pendingTextPrompt.Kind,
                        min: _pendingTextPrompt.Min,
                        max: _pendingTextPrompt.Max,
                        initialText: _pendingTextPrompt.InitialText));
                }

                return;
            }

            _inlinePromptSignature = string.Empty;
            _inlinePromptActionType = string.Empty;
            _inlinePromptCancelActionType = string.Empty;
            InlinePromptTitle = string.Empty;
            InlinePromptFields.Clear();
        }
        catch
        {
            // best-effort
        }
    }

    public async Task<bool> SubmitInlinePromptAsync(CancellationToken cancellationToken = default)
    {
        if (_isSpectator) return false;
        var session = _session;
        if (session == null) return false;
        if (!session.IsConnected) return false;
        if (!HasInlinePrompt) return false;

        var type = (_inlinePromptActionType ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(type)) return false;

        try
        {
            var payload = new Dictionary<string, object>(StringComparer.Ordinal);
            foreach (var field in InlinePromptFields)
            {
                if (field == null || string.IsNullOrWhiteSpace(field.Key)) continue;

                if (field.IsBool)
                {
                    payload[field.Key] = field.BoolValue;
                    continue;
                }

                var text = (field.Text ?? string.Empty).Trim();
                if (string.Equals(field.Kind, "number", StringComparison.OrdinalIgnoreCase) &&
                    int.TryParse(text, out var i))
                {
                    payload[field.Key] = i;
                }
                else
                {
                    payload[field.Key] = text;
                }
            }

            await session
                .SendActionsAsync(new[] { new GameClientAction(type, payload) }, cancellationToken)
                .ConfigureAwait(false);
            return true;
        }
        catch (Exception ex)
        {
            ConnectionStatus = $"Erreur: {ex.Message}";
            return false;
        }
    }

    public async Task<bool> CancelInlinePromptAsync(CancellationToken cancellationToken = default)
    {
        var session = _session;
        if (session == null) return false;
        if (!session.IsConnected) return false;
        if (!HasInlinePrompt) return false;

        var cancel = (_inlinePromptCancelActionType ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(cancel)) return false;

        try
        {
            await session
                .SendActionsAsync(new[] { new GameClientAction(cancel, new Dictionary<string, object>()) }, cancellationToken)
                .ConfigureAwait(false);
            return true;
        }
        catch
        {
            return false;
        }
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
            SyncSelectedDisplayFromChoice();
        }
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        Task? existing;
        lock (_initializeLock)
        {
            existing = _initializeTask;
            if (existing == null)
            {
                _initializeTask = existing = InitializeCoreAsync(cancellationToken);
            }
        }

        await existing.ConfigureAwait(false);
    }

    private async Task InitializeCoreAsync(CancellationToken cancellationToken)
    {
        try
        {
            _projector.ResetLogCursor();
            _realtime.ResetForInitialize();
            await _connection.InitializeAsync(cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            lock (_initializeLock)
            {
                _initializeTask = null;
            }
            throw;
        }
    }

    public async Task<bool> SubmitSelectedChoiceAsync(CancellationToken cancellationToken = default)
    {
        if (_isSpectator)
        {
            const string message = "Mode spectateur : action de jeu interdite.";
            ConnectionStatus = message;
            MessageReceived?.Invoke(new GamePlayHistoryMessage(message));
            return false;
        }

        var session = _session;
        if (session == null) return false;

        var pendingType = (session.LastState?.Pending?.Type ?? string.Empty).Trim();

        try
        {
            var sent = await _choices.SubmitSelectedChoiceAsync(
                    session,
                    emitError: message =>
                    {
                        ConnectionStatus = $"Erreur pending: {message}";
                        MessageReceived?.Invoke(new GamePlayHistoryMessage($"Erreur pending: {message}"));
                    },
                    cancellationToken)
                .ConfigureAwait(false);
            if (sent && string.Equals(pendingType, "quiz", StringComparison.OrdinalIgnoreCase))
            {
                MessageReceived?.Invoke(new GamePlayHistoryMessage("Réponse envoyée."));
            }
            return sent;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de l'envoi d'une action de pending");
            ConnectionStatus = $"Erreur pending: {ex.Message}";
            MessageReceived?.Invoke(new GamePlayHistoryMessage($"Erreur pending: {ex.Message}"));
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
        // Backward-compatible sync wrapper (no blocking).
        // Prefer TryHandleInterfaceShortcutLocallyAsync to ensure latest state (esp. during bot turns).
        return false;
    }

    public async Task<bool> TryHandleInterfaceShortcutLocallyAsync(
        string normalizedKey,
        CancellationToken cancellationToken = default)
    {
        var session = _session;
        if (session == null)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(normalizedKey))
        {
            return false;
        }
        if (cancellationToken.IsCancellationRequested)
        {
            return false;
        }

        // Interface shortcuts should reflect the latest server state (bot turns can update quickly).
        // Request a fresh game.state and fall back to the last known one.
        var state = await _panels.RequestFreshStateAsync(session).ConfigureAwait(true) ?? session.LastState;
        if (state == null)
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
                // Mark as UI/shortcut message so the history sink can announce it assertively
                // without replaying queued older announcements.
                MessageReceived?.Invoke(new GamePlayHistoryMessage($"[ui] {message.Trim()}"));
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

    partial void InitializeHandSupport();
}
