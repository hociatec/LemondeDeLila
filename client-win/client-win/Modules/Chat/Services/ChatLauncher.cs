using System;
using System.Threading.Tasks;
using System.Windows;
using client_win.Modules.Chat.ViewModels;
using client_win.Modules.Chat.Views;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Chat.Services;

/// <summary>
/// Ouvre le tchat dans le shell principal, sans logique réseau dans la couche UI.
/// </summary>
public sealed class ChatLauncher : IChatLauncher
{
    private readonly IChatService _chat;
    private readonly IDialogService _dialogs;
    private readonly IOptionsService _options;
    private readonly INavigationService _navigation;
    private ChatView? _view;
    private System.Windows.Controls.UserControl? _previousView;
    private bool _isCleaningUp;

    public ChatLauncher(IChatService chat, IDialogService dialogs, IOptionsService options, INavigationService navigation)
    {
        _chat = chat ?? throw new ArgumentNullException(nameof(chat));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
    }

    public async Task<string> OpenAsync(Window owner)
    {
        if (!_options.Current.ChatEnabled)
        {
            await _dialogs.ShowInfo("Tchat", "Le tchat est désactivé dans les options.");
            return "Tchat désactivé.";
        }

        bool opened = await _chat.OpenAsync().ConfigureAwait(false);
        if (!opened)
        {
            var err = _chat.LastServerError;
            var message = err?.Message ?? _chat.StatusMessage ?? "Connexion tchat échouée.";
            if (!string.IsNullOrWhiteSpace(err?.Reason))
            {
                message += $"\n\nMotif : {err!.Reason}";
            }
            if (err?.Until is DateTime until)
            {
                message += $"\nJusqu'au : {until.ToLocalTime():dd/MM/yyyy HH:mm}";
            }

            await _dialogs.ShowError("Tchat", message).ConfigureAwait(true);
            return "Connexion tchat échouée.";
        }

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_view == null)
            {
                _previousView = _navigation.CurrentView;
                _view = new ChatView();
                _view.DataContext = new ChatViewModel(_chat, () => _ = CloseAsync());
            }
            _navigation.Show(_view);
            _view.Focus();
        });

        return "Tchat ouvert.";
    }

    public async Task CloseAsync()
    {
        if (_options.Current.ConfirmChatExit)
        {
            var confirm = await _dialogs.Confirm(
                    "Tchat",
                    "Fermer le tchat ?",
                    okText: "Fermer",
                    cancelText: "Annuler")
                .ConfigureAwait(true);
            if (confirm != true)
            {
                return;
            }
        }

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_previousView != null)
            {
                _navigation.Show(_previousView);
            }
        });
        await CleanupAfterCloseAsync();
    }

    private async Task CleanupAfterCloseAsync()
    {
        if (_isCleaningUp)
        {
            return;
        }
        _isCleaningUp = true;

        _view = null;
        _previousView = null;
        await _chat.CloseAsync();
        _isCleaningUp = false;
    }
}
