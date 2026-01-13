using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Stats.Services;
using client_win.Modules.Stats.ViewModels;
using client_win.Modules.Stats.Views;
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
                    social: _services.GetRequiredService<Modules.Social.Services.ISocialService>(),
                    prompts: _services.GetRequiredService<Modules.TextPrompts.Services.ITextPromptService>(),
                    session: _session,
                    dialogs: _services.GetRequiredService<IDialogService>(),
                    joinRoom: roomId => JoinRoomAsync(roomId),
                    openStoryBook: (userId, username) => OpenStoryBookAsync(userId, username),
                    onClose: () => _ = CloseAsync());
            }
            if (_view.DataContext is PresenceViewModel vm)
            {
                vm.ResetForOpen();
                vm.RequestFocusFirstItem();
            }

            _navigation.Show(_view);
            _view.Focus();
        });

        return "Présence ouverte.";
    }

    private async Task OpenStoryBookAsync(int userId, string username)
    {
        var stats = _services.GetRequiredService<IStatsService>();
        // Depuis Présence, Échap doit revenir à la Présence (pas à la vue précédente).
        var returnView = _view ?? _navigation.CurrentView ?? _previousView;
        if (returnView == null)
        {
            return;
        }

        // We temporarily leave the Presence screen to open the story book, but we still want
        // to be able to close Presence later and return to the original view.
        await CloseInternalAsync(restorePrevious: false, preservePreviousView: true).ConfigureAwait(true);

        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
                var view = new StatsView();
                var vm = new StatsViewModel(
                    stats,
                    onClose: () =>
                    {
                        if (returnView is PresenceView presence && presence.DataContext is PresenceViewModel vmPresence)
                        {
                            // Keep the Presence navigation state (PlayerActions) so returning from the story book
                            // lands back on the same menu instead of resetting to the player list.
                            vmPresence.RequestFocusFirstItem();
                        }
                        _navigation.Show(returnView);
                        _ = Application.Current.Dispatcher.BeginInvoke(
                            DispatcherPriority.ApplicationIdle,
                            new Action(() =>
                            {
                                try
                            {
                                if (returnView is PresenceView presence)
                                {
                                    presence.Focus();
                                    presence.MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
                                    return;
                                }

                                if (returnView is GameRoomView room)
                                {
                                    room.RequestFocusGameZone();
                                    return;
                                }

                                if (!returnView.IsKeyboardFocusWithin)
                                {
                                    returnView.MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
                                }
                            }
                            catch
                            {
                                // Best-effort
                            }
                        }));
                },
                targetUserId: userId,
                targetUsername: username);
            view.DataContext = vm;
            _navigation.Show(view);
            view.Focus();
        });
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

    private Task CloseInternalAsync(bool restorePrevious, bool preservePreviousView = false)
    {
        return Application.Current.Dispatcher.InvokeAsync(() =>
        {
            if (restorePrevious && _previousView != null)
            {
                var previous = _previousView;
                _navigation.Show(previous);

                // Après un écran plein (Présence), on redonne explicitement un focus "utile" à la vue précédente.
                // Sans ça, WPF peut laisser le focus sur le host / un élément détruit, et les raccourcis ne repartent pas.
                _ = Application.Current.Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
                {
                    try
                    {
                        if (previous is GameRoomView room)
                        {
                            room.RequestFocusGameZone();
                            return;
                        }

                        if (!previous.IsKeyboardFocusWithin)
                        {
                            previous.MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
                        }
                    }
                    catch
                    {
                        // Best-effort
                    }
                }));
            }
            if (!preservePreviousView)
            {
                _previousView = null;
            }
        }).Task;
    }
}
