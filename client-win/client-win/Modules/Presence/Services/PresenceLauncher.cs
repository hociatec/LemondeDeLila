using System;
using System.Threading.Tasks;
using System.Windows;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Stats.Services;
using client_win.Modules.Stats.ViewModels;
using client_win.Modules.Presence.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.User.Services;
using Microsoft.Extensions.DependencyInjection;

namespace client_win.Modules.Presence.Services;

public sealed class PresenceLauncher : IPresenceLauncher
{
    private readonly IServiceProvider _services;
    private readonly INavigationService _navigation;
    private readonly ISessionService _session;
    private PresenceViewModel? _viewModel;
    private object? _previousContent;

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
            _previousContent = _navigation.CurrentContent;
            if (_viewModel == null)
            {
                _viewModel = new PresenceViewModel(
                    presence: _services.GetRequiredService<IPresenceMonitor>(),
                    rooms: _services.GetRequiredService<Modules.Game.Room.Lobby.Services.IRoomLobbyClient>(),
                    messaging: _services.GetRequiredService<Modules.Messaging.Services.IMessagingService>(),
                    social: _services.GetRequiredService<Modules.Social.Services.ISocialService>(),
                    prompts: _services.GetRequiredService<Modules.TextPrompts.Services.ITextPromptService>(),
                    session: _session,
                    dialogs: _services.GetRequiredService<IDialogService>(),
                    joinRoom: roomId => JoinRoomAsync(roomId),
                    openStoryBook: (userId, username) => OpenStoryBookAsync(userId, username),
                    onClose: () => _ = CloseAsync());
            }
            if (_viewModel != null)
            {
                _viewModel.ResetForOpen();
                _viewModel.RequestFocusFirstItem();
            }

            _navigation.Show(_viewModel!);
        });

        return "Présence ouverte.";
    }

    private async Task OpenStoryBookAsync(int userId, string username)
    {
        var stats = _services.GetRequiredService<IStatsService>();
        // Depuis Présence, Échap doit revenir à la Présence (pas à la vue précédente).
        var returnContent = (object?)_viewModel;
        if (returnContent == null)
        {
            return;
        }

        // We temporarily leave the Presence screen to open the story book, but we still want
        // to be able to close Presence later and return to the original view.

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
                var vm = new StatsViewModel(
                    stats,
                    onClose: () =>
                    {
                        _viewModel?.RequestFocusFirstItem();
                        _navigation.Show(returnContent);
                    },
                targetUserId: userId,
                targetUsername: username);
            _navigation.Show(vm);
        });
    }

    private async Task JoinRoomAsync(int roomId)
    {
        var opener = _services.GetRequiredService<IGameTableOpener>();
        var returnContent = _previousContent ?? _navigation.CurrentContent;
        if (returnContent == null)
        {
            return;
        }

        _viewModel = null;
        _previousContent = null;
        await opener.OpenExistingAsync(roomId, returnContent).ConfigureAwait(true);
    }

    public Task CloseAsync()
    {
        return Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (_previousContent != null)
            {
                _navigation.Show(_previousContent);
            }
            _previousContent = null;
            _viewModel = null;
        }).Task;
    }

}


