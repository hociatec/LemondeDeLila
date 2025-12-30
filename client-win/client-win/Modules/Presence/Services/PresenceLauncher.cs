using System;
using System.Threading.Tasks;
using System.Windows;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Presence.ViewModels;
using client_win.Modules.Presence.Views;
using client_win.Modules.Shell.Services;
using client_win.Modules.User.Services;
using Microsoft.Extensions.DependencyInjection;

namespace client_win.Modules.Presence.Services;

public sealed class PresenceLauncher : IPresenceLauncher
{
    private readonly IServiceProvider _services;
    private readonly INavigationService _navigation;
    private readonly ISessionService _session;
    private PresenceView? _view;
    private System.Windows.Controls.UserControl? _previousView;

    public PresenceLauncher(IServiceProvider services, INavigationService navigation, ISessionService session)
    {
        _services = services ?? throw new ArgumentNullException(nameof(services));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _session = session ?? throw new ArgumentNullException(nameof(session));
    }

    public async Task<string> OpenAsync(Window owner)
    {
        var user = _session.CurrentUser;
        if (user == null || string.IsNullOrWhiteSpace(user.Token))
        {
            return "Connexion requise.";
        }

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            _previousView = _navigation.CurrentView;
            if (_view == null)
            {
                _view = new PresenceView();
                _view.DataContext = new PresenceViewModel(
                    presence: _services.GetRequiredService<IPresenceMonitor>(),
                    rooms: _services.GetRequiredService<Modules.Game.RoomDirectory.Services.IRoomDirectoryClient>(),
                    messaging: _services.GetRequiredService<Modules.Messaging.Services.IMessagingService>(),
                    prompts: _services.GetRequiredService<Modules.TextPrompts.Services.ITextPromptService>(),
                    session: _session,
                    dialogs: _services.GetRequiredService<IDialogService>(),
                    joinRoom: roomId => JoinRoomAsync(roomId),
                    onClose: () => _ = CloseAsync());
            }

            _navigation.Show(_view);
            _view.Focus();
        });

        return "Présence ouverte.";
    }

    private async Task JoinRoomAsync(int roomId)
    {
        var opener = _services.GetRequiredService<IGameTableOpener>();
        var returnView = _previousView ?? _navigation.CurrentView ?? _view;
        if (returnView == null)
        {
            return;
        }
        await CloseInternalAsync(restorePrevious: false).ConfigureAwait(true);
        await opener.OpenExistingAsync(roomId, returnView).ConfigureAwait(true);
    }

    public async Task CloseAsync()
    {
        await CloseInternalAsync(restorePrevious: true).ConfigureAwait(true);
    }

    private Task CloseInternalAsync(bool restorePrevious)
    {
        return Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (restorePrevious && _previousView != null)
            {
                _navigation.Show(_previousView);
            }
            _previousView = null;
        }).Task;
    }
}
