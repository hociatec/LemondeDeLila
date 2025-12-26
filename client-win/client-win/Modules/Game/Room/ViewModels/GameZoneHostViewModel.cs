using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Core.Input;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Room.ViewModels;

public sealed class GameZoneHostViewModel : ObservableObject
{
    private readonly Func<Task> _onQuit;
    private readonly Func<Task> _onAddBot;
    private readonly Func<Task> _onRemoveBot;
    private readonly IDialogService _dialogs;
    private readonly IScreenReaderAnnouncer? _announcer;
    private object? _content;

    public GameZoneHostViewModel(
        Func<Task> onQuit,
        Func<Task> onAddBot,
        Func<Task> onRemoveBot,
        IDialogService dialogs,
        IScreenReaderAnnouncer? announcer = null)
    {
        _onQuit = onQuit ?? throw new ArgumentNullException(nameof(onQuit));
        _onAddBot = onAddBot ?? throw new ArgumentNullException(nameof(onAddBot));
        _onRemoveBot = onRemoveBot ?? throw new ArgumentNullException(nameof(onRemoveBot));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _announcer = announcer;

        AddBotCommand = new AsyncRelayCommand(AddBotAsync);
        RemoveBotCommand = new AsyncRelayCommand(RemoveBotAsync);
        QuitCommand = new AsyncRelayCommand(QuitAsync);

        Shortcuts.Add(new ShortcutDefinition(
            'b',
            AddBotCommand,
            description: "Ajouter un bot"));
        Shortcuts.Add(new ShortcutDefinition(
            'B',
            RemoveBotCommand,
            description: "Retirer un bot"));
        Shortcuts.Add(new ShortcutDefinition(
            'q',
            QuitCommand,
            description: "Quitter la table"));
    }

    public ObservableCollection<ShortcutDefinition> Shortcuts { get; } = new();

    public ICommand AddBotCommand { get; }

    public ICommand RemoveBotCommand { get; }

    public ICommand QuitCommand { get; }

    public object? Content
    {
        get => _content;
        set => SetProperty(ref _content, value);
    }

    public event Action<string>? StatusRequested;

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

    private async Task QuitAsync()
    {
        var confirm = await _dialogs.Confirm(
            "Quitter la table",
            "Voulez-vous quitter la table et revenir au menu principal ?").ConfigureAwait(true);

        if (confirm != true)
        {
            StatusRequested?.Invoke("Retour annulé.");
            return;
        }

        StatusRequested?.Invoke("Retour au menu principal...");
        await _onQuit().ConfigureAwait(true);
    }
}
