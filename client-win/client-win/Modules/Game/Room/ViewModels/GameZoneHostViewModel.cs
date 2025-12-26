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
    private readonly IDialogService _dialogs;
    private object? _content;

    public GameZoneHostViewModel(Func<Task> onQuit, IDialogService dialogs)
    {
        _onQuit = onQuit ?? throw new ArgumentNullException(nameof(onQuit));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));

        QuitCommand = new AsyncRelayCommand(QuitAsync);
        Shortcuts.Add(new ShortcutDefinition(
            'q',
            QuitCommand,
            description: "Quitter la table"));
    }

    public ObservableCollection<ShortcutDefinition> Shortcuts { get; } = new();

    public ICommand QuitCommand { get; }

    public object? Content
    {
        get => _content;
        set => SetProperty(ref _content, value);
    }

    public event Action<string>? StatusRequested;

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

