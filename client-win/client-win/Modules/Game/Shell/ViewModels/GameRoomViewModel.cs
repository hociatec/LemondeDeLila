using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.ViewModels;

public sealed class GameRoomViewModel : ObservableObject
{
    private string _status = "Table prete.";
    private bool _isReconnecting;

    private bool _isStartWizardOpen;
    private bool _isStartWizardAmbienceStep = true;
    private bool _isStartWizardConfigLoading;
    private string _startWizardGameTitle = "Configuration du jeu";
    private Func<Task<StartWizardConfigPrompt?>>? _startWizardLoadConfigPrompt;
    private Task<StartWizardConfigPrompt?>? _startWizardConfigPromptLoadTask;
    private StartWizardConfigPrompt? _startWizardPrompt;
    private TaskCompletionSource<StartWizardResult?>? _startWizardTcs;

    public GameRoomViewModel(
        CatalogGame game,
        Func<string, Task> onSendChat,
        Func<Task> onShowRules,
        Func<Task> onConfigureTableAmbience,
        Func<Task> onConfigureTableAmbienceVolume,
        Func<Task> onStart,
        Func<Task> onSaveSnapshot,
        Func<Task> onReset,
        Func<Task> onQuit,
        Func<Task> onAddBot,
        Func<Task> onRemoveBot,
        Func<Task> onAnnouncePlayers,
        Func<Task> onAnnounceInfo,
        Func<Task> onTogglePrivacy,
        Func<Task> onToggleRole,
        Func<Task> onInvite,
        Func<Task> onKick,
        Func<Task> onBan,
        Func<Task> onTransferOwner,
        IDialogService dialogs,
        IGameFocusCoordinator focusCoordinator,
        IScreenReaderAnnouncer screenReader,
        IAnnouncementService announcements)
    {
        Game = game ?? throw new ArgumentNullException(nameof(game));
        ScreenReader = screenReader ?? throw new ArgumentNullException(nameof(screenReader));
        Announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        History = new GameHistoryViewModel(game);

        var title = !string.IsNullOrWhiteSpace(game.Name) ? game.Name : game.Id;
        GameZone = new GameZoneHostViewModel(
            title,
            onShowRules,
            onConfigureTableAmbience,
            onConfigureTableAmbienceVolume,
            onStart,
            onSaveSnapshot,
            onReset,
            onQuit,
            onAddBot,
            onRemoveBot,
            onAnnouncePlayers,
            onAnnounceInfo,
            onTogglePrivacy,
            onToggleRole,
            onInvite,
            onKick,
            onBan,
            onTransferOwner,
            dialogs,
            focusCoordinator);
        GameZone.StatusRequested += s => Status = s;

        Chat = new GameRoomChatViewModel(game.ChatEnabled, onSendChat);
        Chat.IsSoundsEnabled = game.ChatSoundsEnabled;
    }

    public CatalogGame Game { get; }

    public IScreenReaderAnnouncer ScreenReader { get; }

    public IAnnouncementService Announcements { get; }

    public GameHistoryViewModel History { get; }

    public GameZoneHostViewModel GameZone { get; }

    public GameRoomChatViewModel Chat { get; }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    public bool IsReconnecting
    {
        get => _isReconnecting;
        set => SetProperty(ref _isReconnecting, value);
    }

    public ObservableCollection<StartWizardAmbienceChoice> StartWizardAmbienceChoices { get; } = new();
    public ObservableCollection<StartWizardConfigFieldVm> StartWizardConfigFields { get; } = new();

    public StartWizardAmbienceChoice? StartWizardSelectedAmbience { get; set; }

    public bool IsStartWizardOpen
    {
        get => _isStartWizardOpen;
        private set => SetProperty(ref _isStartWizardOpen, value);
    }

    public bool IsStartWizardAmbienceStep
    {
        get => _isStartWizardAmbienceStep;
        private set
        {
            if (SetProperty(ref _isStartWizardAmbienceStep, value))
            {
                OnPropertyChanged(nameof(IsStartWizardConfigStep));
                OnPropertyChanged(nameof(StartWizardTitle));
                OnPropertyChanged(nameof(StartWizardDescription));
            }
        }
    }

    public bool IsStartWizardConfigStep => !IsStartWizardAmbienceStep;

    public bool HasStartWizardConfig => StartWizardConfigFields.Count > 0;

    public bool IsStartWizardConfigLoading
    {
        get => _isStartWizardConfigLoading;
        private set
        {
            if (SetProperty(ref _isStartWizardConfigLoading, value))
            {
                OnPropertyChanged(nameof(StartWizardDescription));
            }
        }
    }

    public string StartWizardTitle => IsStartWizardAmbienceStep ? "Configuration de la table" : _startWizardGameTitle;

    public string StartWizardDescription => IsStartWizardAmbienceStep
        ? "Avant de démarrer, choisissez l'ambiance de la table."
        : (IsStartWizardConfigLoading
            ? "Chargement de la configuration du jeu..."
            : (HasStartWizardConfig ? "Ajustez la configuration du jeu, puis démarrez." : "Aucune configuration de jeu requise. Vous pouvez démarrer."));

    public async Task<StartWizardResult?> OpenStartWizardAsync(
        string currentAmbienceSoundId,
        IReadOnlyList<StartWizardAmbienceChoice> ambienceChoices,
        StartWizardConfigPrompt? initialConfigPrompt,
        Func<Task<StartWizardConfigPrompt?>>? loadConfigPromptAsync)
    {
        _startWizardLoadConfigPrompt = loadConfigPromptAsync;
        _startWizardConfigPromptLoadTask = null;
        _startWizardPrompt = null;
        IsStartWizardConfigLoading = false;

        StartWizardAmbienceChoices.Clear();
        foreach (var c in ambienceChoices ?? Array.Empty<StartWizardAmbienceChoice>())
        {
            StartWizardAmbienceChoices.Add(c);
        }

        StartWizardSelectedAmbience = StartWizardAmbienceChoices
            .FirstOrDefault(c => string.Equals(c.SoundId, (currentAmbienceSoundId ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase))
            ?? StartWizardAmbienceChoices.FirstOrDefault();
        OnPropertyChanged(nameof(StartWizardSelectedAmbience));

        BindStartWizardConfigPrompt(initialConfigPrompt);
        IsStartWizardAmbienceStep = true;
        IsStartWizardOpen = true;
        if (initialConfigPrompt == null && _startWizardLoadConfigPrompt != null)
        {
            _startWizardConfigPromptLoadTask = _startWizardLoadConfigPrompt();
            IsStartWizardConfigLoading = true;
        }

        _startWizardTcs = new TaskCompletionSource<StartWizardResult?>(TaskCreationOptions.RunContinuationsAsynchronously);
        return await _startWizardTcs.Task.ConfigureAwait(true);
    }

    public async Task GoNextStartWizardStepAsync()
    {
        if (!IsStartWizardOpen)
        {
            return;
        }

        if (IsStartWizardAmbienceStep)
        {
            if (StartWizardConfigFields.Count == 0 &&
                (_startWizardConfigPromptLoadTask != null || _startWizardLoadConfigPrompt != null))
            {
                await EnsureStartWizardPromptLoadedAsync().ConfigureAwait(true);
            }

            if (StartWizardConfigFields.Count == 0)
            {
                // No game-specific configuration: keep single-step flow.
                return;
            }

            IsStartWizardAmbienceStep = false;
        }
    }

    public void GoPreviousStartWizardStep()
    {
        if (!IsStartWizardOpen)
        {
            return;
        }

        IsStartWizardAmbienceStep = true;
    }

    public void CancelStartWizard()
    {
        if (!IsStartWizardOpen)
        {
            return;
        }

        IsStartWizardOpen = false;
        _startWizardLoadConfigPrompt = null;
        _startWizardConfigPromptLoadTask = null;
        IsStartWizardConfigLoading = false;
        _startWizardPrompt = null;
        _startWizardTcs?.TrySetResult(null);
        _startWizardTcs = null;
    }

    public async Task ConfirmStartWizardAsync()
    {
        if (!IsStartWizardOpen)
        {
            return;
        }

        if (IsStartWizardAmbienceStep)
        {
            if (StartWizardConfigFields.Count == 0 &&
                (_startWizardConfigPromptLoadTask != null || _startWizardLoadConfigPrompt != null))
            {
                await EnsureStartWizardPromptLoadedAsync().ConfigureAwait(true);
            }

            if (StartWizardConfigFields.Count > 0)
            {
                await GoNextStartWizardStepAsync().ConfigureAwait(true);
                return;
            }

            var singleStepResult = new StartWizardResult(
                AmbienceSoundId: StartWizardSelectedAmbience?.SoundId ?? string.Empty,
                GameConfigActionType: string.Empty,
                GameConfigPayload: new Dictionary<string, object>(StringComparer.Ordinal));

            IsStartWizardOpen = false;
            _startWizardLoadConfigPrompt = null;
            _startWizardConfigPromptLoadTask = null;
            IsStartWizardConfigLoading = false;
            _startWizardPrompt = null;
            _startWizardTcs?.TrySetResult(singleStepResult);
            _startWizardTcs = null;
            return;
        }

        if (IsStartWizardConfigLoading)
        {
            Status = "Configuration: chargement en cours...";
            return;
        }

        var payload = BuildStartWizardConfigPayload();
        if (payload == null)
        {
            return;
        }

        var result = new StartWizardResult(
            AmbienceSoundId: StartWizardSelectedAmbience?.SoundId ?? string.Empty,
            GameConfigActionType: (_startWizardPrompt?.ActionType ?? string.Empty).Trim(),
            GameConfigPayload: payload);

        IsStartWizardOpen = false;
        _startWizardLoadConfigPrompt = null;
        _startWizardConfigPromptLoadTask = null;
        IsStartWizardConfigLoading = false;
        _startWizardPrompt = null;
        _startWizardTcs?.TrySetResult(result);
        _startWizardTcs = null;
    }

    private async Task EnsureStartWizardPromptLoadedAsync()
    {
        if (!IsStartWizardOpen)
        {
            return;
        }

        if (StartWizardConfigFields.Count > 0)
        {
            IsStartWizardConfigLoading = false;
            return;
        }

        if (_startWizardLoadConfigPrompt == null && _startWizardConfigPromptLoadTask == null)
        {
            IsStartWizardConfigLoading = false;
            return;
        }

        try
        {
            IsStartWizardConfigLoading = true;
            _startWizardConfigPromptLoadTask ??= _startWizardLoadConfigPrompt?.Invoke();
            var prompt = _startWizardConfigPromptLoadTask != null
                ? await _startWizardConfigPromptLoadTask.ConfigureAwait(true)
                : null;
            BindStartWizardConfigPrompt(prompt);
        }
        catch
        {
            BindStartWizardConfigPrompt(null);
        }
        finally
        {
            IsStartWizardConfigLoading = false;
        }
    }

    private Dictionary<string, object>? BuildStartWizardConfigPayload()
    {
        if (!HasStartWizardConfig)
        {
            return new Dictionary<string, object>(StringComparer.Ordinal);
        }

        var payload = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (var field in StartWizardConfigFields)
        {
            if (field.IsBool)
            {
                payload[field.Key] = field.BoolValue;
                continue;
            }

            var text = (field.Text ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                Status = $"Configuration: remplir {field.Label}.";
                return null;
            }

            var isNumber = string.Equals(field.Kind, "number", StringComparison.OrdinalIgnoreCase);
            if (!isNumber)
            {
                payload[field.Key] = text;
                continue;
            }

            if (!int.TryParse(text, out var value))
            {
                Status = $"Configuration: {field.Label} doit être un nombre.";
                return null;
            }
            if (field.Min.HasValue && value < field.Min.Value)
            {
                Status = $"Configuration: min {field.Min.Value} pour {field.Label}.";
                return null;
            }
            if (field.Max.HasValue && value > field.Max.Value)
            {
                Status = $"Configuration: max {field.Max.Value} pour {field.Label}.";
                return null;
            }
            payload[field.Key] = value;
        }

        return payload;
    }

    private void BindStartWizardConfigPrompt(StartWizardConfigPrompt? prompt)
    {
        _startWizardPrompt = prompt;
        StartWizardConfigFields.Clear();
        _startWizardGameTitle = string.IsNullOrWhiteSpace(prompt?.Title) ? "Configuration du jeu" : prompt!.Title.Trim();
        OnPropertyChanged(nameof(StartWizardTitle));

        if (prompt?.Fields == null)
        {
            OnPropertyChanged(nameof(HasStartWizardConfig));
            OnPropertyChanged(nameof(StartWizardDescription));
            return;
        }

        foreach (var f in prompt.Fields)
        {
            var key = (f.Key ?? string.Empty).Trim();
            if (key.Length == 0)
            {
                continue;
            }

            StartWizardConfigFields.Add(new StartWizardConfigFieldVm(
                key: key,
                label: string.IsNullOrWhiteSpace(f.Label) ? key : f.Label.Trim(),
                kind: (f.Kind ?? "text").Trim(),
                min: f.Min,
                max: f.Max,
                initialText: f.InitialText ?? string.Empty));
        }

        OnPropertyChanged(nameof(HasStartWizardConfig));
        OnPropertyChanged(nameof(StartWizardDescription));
    }

    public sealed record StartWizardAmbienceChoice(string SoundId, string Label)
    {
        public override string ToString() => Label ?? string.Empty;
    }

    public sealed record StartWizardConfigField(string Key, string Label, string Kind, int? Min, int? Max, string InitialText)
    {
        public override string ToString() => Label ?? Key ?? string.Empty;
    }
    public sealed record StartWizardConfigPrompt(string Title, string ActionType, string? CancelActionType, IReadOnlyList<StartWizardConfigField> Fields);
    public sealed record StartWizardResult(string AmbienceSoundId, string GameConfigActionType, Dictionary<string, object>? GameConfigPayload);

    public sealed class StartWizardConfigFieldVm : ObservableObject
    {
        private string _text = string.Empty;
        private bool _boolValue;

        public StartWizardConfigFieldVm(string key, string label, string kind, int? min, int? max, string initialText)
        {
            Key = key;
            Label = label;
            Kind = kind;
            Min = min;
            Max = max;
            Text = initialText;
            BoolValue = ParseBool(initialText);
        }

        public string Key { get; }
        public string Label { get; }
        public string Kind { get; }
        public int? Min { get; }
        public int? Max { get; }

        public bool IsBool =>
            string.Equals(Kind, "bool", StringComparison.OrdinalIgnoreCase) ||
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

        private static bool ParseBool(string? text)
        {
            var v = (text ?? string.Empty).Trim().ToLowerInvariant();
            return v is "true" or "1" or "oui" or "yes" or "on";
        }

        public override string ToString() => Label ?? Key ?? string.Empty;
    }
}
