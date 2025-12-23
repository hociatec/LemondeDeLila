using System;
using System.Threading.Tasks;
using System.Windows;
using client_win.Core;
using client_win.Modules.Chat.ViewModels;
using client_win.Modules.Chat.Views;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Chat.Services;

/// <summary>
/// Ouvre la fenêtre de tchat en MVVM, sans logique réseau dans la couche UI.
/// </summary>
public sealed class ChatLauncher : IChatLauncher
{
    private readonly IChatService _chat;
    private readonly IDialogService _dialogs;
    private readonly IOptionsService _options;
    private readonly IViewFactory<ChatWindow> _windowFactory;
    private ChatWindow? _window;
    private Window? _owner;
    private bool _isCleaningUp;

    public ChatLauncher(IChatService chat, IDialogService dialogs, IOptionsService options, IViewFactory<ChatWindow> windowFactory)
    {
        _chat = chat ?? throw new ArgumentNullException(nameof(chat));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _windowFactory = windowFactory ?? throw new ArgumentNullException(nameof(windowFactory));
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
            return "Connexion tchat échouée.";
        }

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_window == null || !_window.IsLoaded)
            {
                _owner = owner;
                _window = _windowFactory.Create();
                _window.DataContext = new ChatViewModel(_chat, () => _window?.Close());
                _window.Owner = owner;
                _window.Closed += async (_, _) => await CleanupAfterCloseAsync();
            }
            if (_owner == null)
            {
                _owner = owner;
            }
            if (_owner != null)
            {
                _owner.IsEnabled = false;
            }
            _window.Show();
            _window.Activate();
        });

        return "Tchat ouvert.";
    }

    public async Task CloseAsync()
    {
        if (_window != null)
        {
            await Application.Current.Dispatcher.InvokeAsync(() => _window.Close());
            return;
        }
        if (_owner != null)
        {
            _owner.IsEnabled = true;
            _owner = null;
        }
        await _chat.CloseAsync();
    }

    private async Task CleanupAfterCloseAsync()
    {
        if (_isCleaningUp)
        {
            return;
        }
        _isCleaningUp = true;

        if (_owner != null)
        {
            _owner.IsEnabled = true;
            _owner = null;
        }
        _window = null;
        await _chat.CloseAsync();
        _isCleaningUp = false;
    }
}
