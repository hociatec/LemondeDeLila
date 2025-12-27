using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Core.Input;
using client_win.Modules.Game.Room.Input;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.ViewModels;

public sealed class GameZoneHostViewModel : ObservableObject
{
    private readonly Func<Task> _onStart;
    private readonly Func<Task> _onReset;
    private readonly Func<Task> _onQuit;
    private readonly Func<Task> _onAddBot;
    private readonly Func<Task> _onRemoveBot;
    private readonly Func<Task> _onAnnouncePlayers;
    private readonly Func<Task> _onAnnounceInfo;
    private readonly Func<Task> _onTogglePrivacy;
    private readonly Func<Task> _onToggleRole;
    private readonly IDialogService _dialogs;
    private object? _content;
    private string _title = "Zone de jeu";
    private bool _isStarted;

    public GameZoneHostViewModel(
        string title,
        Func<Task> onStart,
        Func<Task> onReset,
        Func<Task> onQuit,
        Func<Task> onAddBot,
        Func<Task> onRemoveBot,
        Func<Task> onAnnouncePlayers,
        Func<Task> onAnnounceInfo,
        Func<Task> onTogglePrivacy,
        Func<Task> onToggleRole,
        IDialogService dialogs)
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Zone de jeu" : title;
        _onStart = onStart ?? throw new ArgumentNullException(nameof(onStart));
        _onReset = onReset ?? throw new ArgumentNullException(nameof(onReset));
        _onQuit = onQuit ?? throw new ArgumentNullException(nameof(onQuit));
        _onAddBot = onAddBot ?? throw new ArgumentNullException(nameof(onAddBot));
        _onRemoveBot = onRemoveBot ?? throw new ArgumentNullException(nameof(onRemoveBot));
        _onAnnouncePlayers = onAnnouncePlayers ?? throw new ArgumentNullException(nameof(onAnnouncePlayers));
        _onAnnounceInfo = onAnnounceInfo ?? throw new ArgumentNullException(nameof(onAnnounceInfo));
        _onTogglePrivacy = onTogglePrivacy ?? throw new ArgumentNullException(nameof(onTogglePrivacy));
        _onToggleRole = onToggleRole ?? throw new ArgumentNullException(nameof(onToggleRole));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));

        StartCommand = new AsyncRelayCommand(StartAsync, () => !_isStarted);
        ResetCommand = new AsyncRelayCommand(ResetAsync);
        AddBotCommand = new AsyncRelayCommand(AddBotAsync);
        RemoveBotCommand = new AsyncRelayCommand(RemoveBotAsync);
        AnnouncePlayersCommand = new AsyncRelayCommand(AnnouncePlayersAsync);
        AnnounceInfoCommand = new AsyncRelayCommand(AnnounceInfoAsync);
        TogglePrivacyCommand = new AsyncRelayCommand(TogglePrivacyAsync);
        ToggleRoleCommand = new AsyncRelayCommand(ToggleRoleAsync);
        QuitCommand = new AsyncRelayCommand(QuitAsync);

        foreach (var shortcut in RoomShortcuts.Create(
                     resetCommand: ResetCommand,
                     addBotCommand: AddBotCommand,
                     removeBotCommand: RemoveBotCommand,
                     announcePlayersCommand: AnnouncePlayersCommand,
                     announceInfoCommand: AnnounceInfoCommand,
                     togglePrivacyCommand: TogglePrivacyCommand,
                     toggleRoleCommand: ToggleRoleCommand,
                     quitCommand: QuitCommand))
        {
            Shortcuts.Add(shortcut);
        }
    }

    public ObservableCollection<ShortcutDefinition> Shortcuts { get; } = new();

    public ICommand StartCommand { get; }
    public ICommand ResetCommand { get; }
    public ICommand AddBotCommand { get; }
    public ICommand RemoveBotCommand { get; }
    public ICommand AnnouncePlayersCommand { get; }
    public ICommand AnnounceInfoCommand { get; }
    public ICommand TogglePrivacyCommand { get; }
    public ICommand ToggleRoleCommand { get; }
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
                if (StartCommand is AsyncRelayCommand asyncCmd)
                {
                    asyncCmd.RaiseCanExecuteChanged();
                }
            }
        }
    }

    public event Action<string>? StatusRequested;
    public event Action? FocusRequested;

    private async Task StartAsync()
    {
        StatusRequested?.Invoke("Demarrage de la table...");
        await _onStart().ConfigureAwait(true);
    }

    private async Task ResetAsync()
    {
        var confirm = await _dialogs.Confirm(
                "Reinitialiser la table",
                "Etes-vous sur d'arrêter la partie en cours ?")
            .ConfigureAwait(true);

        if (confirm != true)
        {
            StatusRequested?.Invoke("Reinitialisation annulee.");
            FocusRequested?.Invoke();
            return;
        }

        StatusRequested?.Invoke("Reinitialisation de la table...");
        await _onReset().ConfigureAwait(true);
    }

    private async Task AddBotAsync()
    {
        StatusRequested?.Invoke("Ajout d'un bot...");
        await _onAddBot().ConfigureAwait(true);
    }

    private async Task RemoveBotAsync()
    {
        StatusRequested?.Invoke("Retrait d'un bot...");
        await _onRemoveBot().ConfigureAwait(true);
    }

    private async Task AnnouncePlayersAsync()
    {
        StatusRequested?.Invoke("Liste des joueurs...");
        await _onAnnouncePlayers().ConfigureAwait(true);
    }

    private async Task AnnounceInfoAsync()
    {
        StatusRequested?.Invoke("Informations...");
        await _onAnnounceInfo().ConfigureAwait(true);
    }

    private async Task TogglePrivacyAsync()
    {
        StatusRequested?.Invoke("Changement de visibilite...");
        await _onTogglePrivacy().ConfigureAwait(true);
    }

    private async Task ToggleRoleAsync()
    {
        StatusRequested?.Invoke("Changement de mode...");
        await _onToggleRole().ConfigureAwait(true);
    }

    private async Task QuitAsync()
    {
        var confirm = await _dialogs.Confirm(
                "Quitter la table",
                "Voulez-vous quitter la table et revenir au menu principal ?")
            .ConfigureAwait(true);

        if (confirm != true)
        {
            StatusRequested?.Invoke("Retour annule.");
            return;
        }

        StatusRequested?.Invoke("Retour au menu principal...");
        await _onQuit().ConfigureAwait(true);
    }
}
