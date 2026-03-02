using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Core.Input;
using client_win.Modules.Game.Room.Input;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.ViewModels;

public sealed class GameZoneHostViewModel : ObservableObject
{
    private readonly Func<Task> _onStart;
    private readonly Func<Task> _onSaveSnapshot;
    private readonly Func<Task> _onReset;
    private readonly Func<Task> _onQuit;
    private readonly Func<Task> _onAddBot;
    private readonly Func<Task> _onRemoveBot;
    private readonly Func<Task> _onAnnouncePlayers;
    private readonly Func<Task> _onAnnounceInfo;
    private readonly Func<Task> _onTogglePrivacy;
    private readonly Func<Task> _onToggleRole;
    private readonly Func<Task> _onInvite;
    private readonly Func<Task> _onKick;
    private readonly Func<Task> _onBan;
    private readonly Func<Task> _onTransferOwner;
    private readonly Func<Task> _onShowRules;
    private readonly Func<Task> _onConfigureTableAmbience;
    private readonly Func<Task> _onConfigureTableAmbienceVolume;
    private readonly IDialogService _dialogs;
    private readonly IGameFocusCoordinator _focus;
    private object? _content;
    private string _title = "Zone de jeu";
    private bool _isStarted;
    private bool _isConnected = true;
    private bool _canStart = false;

    public GameZoneHostViewModel(
        string title,
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
        IGameFocusCoordinator focus)
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Zone de jeu" : title;
        _onShowRules = onShowRules ?? throw new ArgumentNullException(nameof(onShowRules));
        _onConfigureTableAmbience = onConfigureTableAmbience ?? throw new ArgumentNullException(nameof(onConfigureTableAmbience));
        _onConfigureTableAmbienceVolume = onConfigureTableAmbienceVolume ?? throw new ArgumentNullException(nameof(onConfigureTableAmbienceVolume));
        _onStart = onStart ?? throw new ArgumentNullException(nameof(onStart));
        _onSaveSnapshot = onSaveSnapshot ?? throw new ArgumentNullException(nameof(onSaveSnapshot));
        _onReset = onReset ?? throw new ArgumentNullException(nameof(onReset));
        _onQuit = onQuit ?? throw new ArgumentNullException(nameof(onQuit));
        _onAddBot = onAddBot ?? throw new ArgumentNullException(nameof(onAddBot));
        _onRemoveBot = onRemoveBot ?? throw new ArgumentNullException(nameof(onRemoveBot));
        _onAnnouncePlayers = onAnnouncePlayers ?? throw new ArgumentNullException(nameof(onAnnouncePlayers));
        _onAnnounceInfo = onAnnounceInfo ?? throw new ArgumentNullException(nameof(onAnnounceInfo));
        _onTogglePrivacy = onTogglePrivacy ?? throw new ArgumentNullException(nameof(onTogglePrivacy));
        _onToggleRole = onToggleRole ?? throw new ArgumentNullException(nameof(onToggleRole));
        _onInvite = onInvite ?? throw new ArgumentNullException(nameof(onInvite));
        _onKick = onKick ?? throw new ArgumentNullException(nameof(onKick));
        _onBan = onBan ?? throw new ArgumentNullException(nameof(onBan));
        _onTransferOwner = onTransferOwner ?? throw new ArgumentNullException(nameof(onTransferOwner));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _focus = focus ?? throw new ArgumentNullException(nameof(focus));

        StartCommand = new AsyncRelayCommand(StartAsync, () => IsConnected && !_isStarted && _canStart);
        SaveSnapshotCommand = new AsyncRelayCommand(SaveSnapshotAsync, () => IsConnected && _isStarted);
        ResetCommand = new AsyncRelayCommand(ResetAsync, () => IsConnected);
        AddBotCommand = new AsyncRelayCommand(AddBotAsync, () => IsConnected);
        RemoveBotCommand = new AsyncRelayCommand(RemoveBotAsync, () => IsConnected);
        AnnouncePlayersCommand = new AsyncRelayCommand(AnnouncePlayersAsync, () => IsConnected);
        AnnounceInfoCommand = new AsyncRelayCommand(AnnounceInfoAsync, () => IsConnected);
        TogglePrivacyCommand = new AsyncRelayCommand(TogglePrivacyAsync, () => IsConnected);
        ToggleRoleCommand = new AsyncRelayCommand(ToggleRoleAsync, () => IsConnected);
        InviteCommand = new AsyncRelayCommand(InviteAsync, () => IsConnected);
        KickCommand = new AsyncRelayCommand(KickAsync, () => IsConnected);
        BanCommand = new AsyncRelayCommand(BanAsync, () => IsConnected);
        TransferOwnerCommand = new AsyncRelayCommand(TransferOwnerAsync, () => IsConnected);
        RulesCommand = new AsyncRelayCommand(ShowRulesAsync, () => IsConnected);
        ConfigureTableAmbienceCommand = new AsyncRelayCommand(ConfigureTableAmbienceAsync, () => IsConnected);
        ConfigureTableAmbienceVolumeCommand = new AsyncRelayCommand(ConfigureTableAmbienceVolumeAsync, () => IsConnected);
        QuitCommand = new AsyncRelayCommand(QuitAsync);

        foreach (var shortcut in RoomShortcuts.Create(
                     rulesCommand: RulesCommand,
                     tableAmbienceCommand: ConfigureTableAmbienceCommand,
                     tableAmbienceVolumeCommand: ConfigureTableAmbienceVolumeCommand,
                     saveSnapshotCommand: SaveSnapshotCommand,
                     resetCommand: ResetCommand,
                     addBotCommand: AddBotCommand,
                     removeBotCommand: RemoveBotCommand,
                     announcePlayersCommand: AnnouncePlayersCommand,
                     announceInfoCommand: AnnounceInfoCommand,
                     togglePrivacyCommand: TogglePrivacyCommand,
                     toggleRoleCommand: ToggleRoleCommand,
                     inviteCommand: InviteCommand,
                     kickCommand: KickCommand,
                     banCommand: BanCommand,
                     transferOwnerCommand: TransferOwnerCommand,
                     quitCommand: QuitCommand))
        {
            Shortcuts.Add(shortcut);
        }
    }

    public ObservableCollection<ShortcutDefinition> Shortcuts { get; } = new();

    public ICommand StartCommand { get; }
    public ICommand SaveSnapshotCommand { get; }
    public ICommand ResetCommand { get; }
    public ICommand AddBotCommand { get; }
    public ICommand RemoveBotCommand { get; }
    public ICommand AnnouncePlayersCommand { get; }
    public ICommand AnnounceInfoCommand { get; }
    public ICommand TogglePrivacyCommand { get; }
    public ICommand ToggleRoleCommand { get; }
    public ICommand InviteCommand { get; }
    public ICommand KickCommand { get; }
    public ICommand BanCommand { get; }
    public ICommand TransferOwnerCommand { get; }
    public ICommand RulesCommand { get; }
    public ICommand ConfigureTableAmbienceCommand { get; }
    public ICommand ConfigureTableAmbienceVolumeCommand { get; }
    public ICommand QuitCommand { get; }

    public object? Content
    {
        get => _content;
        set => SetProperty(ref _content, value);
    }

    public string Title
    {
        get => _title;
        set => SetProperty(ref _title, value);
    }

    public bool IsStarted
    {
        get => _isStarted;
        set
        {
            if (SetProperty(ref _isStarted, value))
            {
                RaiseCommandsCanExecuteChanged();
            }
        }
    }

    public bool IsConnected
    {
        get => _isConnected;
        set
        {
            if (SetProperty(ref _isConnected, value))
            {
                RaiseCommandsCanExecuteChanged();
            }
        }
    }

    public bool CanStart
    {
        get => _canStart;
        set
        {
            if (SetProperty(ref _canStart, value))
            {
                RaiseCommandsCanExecuteChanged();
            }
        }
    }

    public event Action<string>? StatusRequested;

    public IGameFocusCoordinator FocusCoordinator => _focus;

    public void RequestFocus(GameFocusReason reason = GameFocusReason.Default) => _focus.RequestGameZone(reason);

    private void RaiseCommandsCanExecuteChanged()
    {
        static void Raise(ICommand cmd)
        {
            if (cmd is AsyncRelayCommand asyncCmd)
            {
                asyncCmd.RaiseCanExecuteChanged();
            }
        }

        Raise(StartCommand);
        Raise(SaveSnapshotCommand);
        Raise(ResetCommand);
        Raise(AddBotCommand);
        Raise(RemoveBotCommand);
        Raise(AnnouncePlayersCommand);
        Raise(AnnounceInfoCommand);
        Raise(TogglePrivacyCommand);
        Raise(ToggleRoleCommand);
        Raise(InviteCommand);
        Raise(KickCommand);
        Raise(BanCommand);
        Raise(TransferOwnerCommand);
        Raise(RulesCommand);
        Raise(ConfigureTableAmbienceCommand);
        Raise(ConfigureTableAmbienceVolumeCommand);
    }

    private async Task StartAsync()
    {
        await _onStart().ConfigureAwait(true);
    }

    private async Task SaveSnapshotAsync()
    {
        await _onSaveSnapshot().ConfigureAwait(true);
    }

    private async Task ResetAsync()
    {
        // Hors partie, pas besoin de confirmation : le reset sert souvent à "rattraper" un état incohérent.
        if (!_isStarted)
        {
            await _onReset().ConfigureAwait(true);
            return;
        }

        var confirm = await _dialogs.Confirm(
                "Réinitialiser la table",
                "Êtes-vous sûr d'arrêter la partie en cours ?")
            .ConfigureAwait(true);

        if (confirm != true)
        {
            StatusRequested?.Invoke("Réinitialisation annulée.");
            RequestFocus(GameFocusReason.AfterDialog);
            return;
        }

        await _onReset().ConfigureAwait(true);
    }

    private async Task AddBotAsync()
    {
        await _onAddBot().ConfigureAwait(true);
    }

    private async Task RemoveBotAsync()
    {
        await _onRemoveBot().ConfigureAwait(true);
    }

    private async Task AnnouncePlayersAsync()
    {
        await _onAnnouncePlayers().ConfigureAwait(true);
    }

    private async Task AnnounceInfoAsync()
    {
        await _onAnnounceInfo().ConfigureAwait(true);
    }

    private async Task TogglePrivacyAsync()
    {
        await _onTogglePrivacy().ConfigureAwait(true);
    }

    private async Task ToggleRoleAsync()
    {
        await _onToggleRole().ConfigureAwait(true);
    }

    private async Task InviteAsync()
    {
        await _onInvite().ConfigureAwait(true);
    }

    private async Task KickAsync()
    {
        await _onKick().ConfigureAwait(true);
    }

    private async Task BanAsync()
    {
        await _onBan().ConfigureAwait(true);
    }

    private async Task TransferOwnerAsync()
    {
        await _onTransferOwner().ConfigureAwait(true);
    }

    private async Task ShowRulesAsync()
    {
        await _onShowRules().ConfigureAwait(true);
    }

    private async Task ConfigureTableAmbienceAsync()
    {
        await _onConfigureTableAmbience().ConfigureAwait(true);
    }

    private async Task ConfigureTableAmbienceVolumeAsync()
    {
        await _onConfigureTableAmbienceVolume().ConfigureAwait(true);
    }

    private async Task QuitAsync()
    {
        var confirm = await _dialogs.Confirm(
                "Quitter la table",
                "Voulez-vous quitter la table et revenir au menu précédent ?")
            .ConfigureAwait(true);

        if (confirm != true)
        {
            StatusRequested?.Invoke("Retour annulé.");
            return;
        }

        await _onQuit().ConfigureAwait(true);
    }
}

