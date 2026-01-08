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
    private readonly IAnnouncementService _announcements;
    private ChatView? _view;
    private System.Windows.Controls.UserControl? _previousView;
    private bool _isCleaningUp;
    private bool _isOpening;

    public ChatLauncher(
        IChatService chat,
        IDialogService dialogs,
        IOptionsService options,
        INavigationService navigation,
        IAnnouncementService announcements)
    {
        _chat = chat ?? throw new ArgumentNullException(nameof(chat));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
    }

    public async Task<string> OpenAsync(Window owner)
    {
        if (!_options.Current.ChatEnabled)
        {
            await _dialogs.ShowInfo("Tchat", "Le tchat est désactivé dans les options.");
            return "Tchat désactivé.";
        }

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_view == null)
            {
                _previousView = _navigation.CurrentView;
                _view = new ChatView();
                _view.DataContext = new ChatViewModel(_chat, () => _ = CloseAsync(), _dialogs, _announcements);
            }
            _navigation.Show(_view);
            _view.Focus();
        });

        _ = EnsureChatConnectionAsync();
        return "Ouverture du tchat...";
    }

    private async Task EnsureChatConnectionAsync()
    {
        if (_isOpening)
        {
            return;
        }

        _isOpening = true;
        try
        {
            bool opened = await _chat.OpenAsync().ConfigureAwait(false);
            if (opened)
            {
                return;
            }

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
            await ReturnToPreviousViewAsync().ConfigureAwait(true);
            await CleanupAfterCloseAsync().ConfigureAwait(false);
        }
        finally
        {
            _isOpening = false;
        }
    }

    private async Task ReturnToPreviousViewAsync()
    {
        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_previousView != null)
            {
                _navigation.Show(_previousView);
            }
        });
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

        await ReturnToPreviousViewAsync().ConfigureAwait(true);
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
