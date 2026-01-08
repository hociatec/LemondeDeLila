using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Extensions.Logging;
using client_win.Modules.Admin.ViewModels;
using client_win.Modules.Admin.Views;
using client_win.Modules.Config;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Catalog.ViewModels;
using client_win.Modules.Catalog.Views;
using client_win.Modules.Chat.Services;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Messaging.ViewModels;
using client_win.Modules.Messaging.Views;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Social.Services;
using client_win.Modules.Social.ViewModels;
using client_win.Modules.Social.Views;
using client_win.Modules.Stats.Services;
using client_win.Modules.Stats.ViewModels;
using client_win.Modules.Stats.Views;
using client_win.Modules.Leaderboard.Services;
using client_win.Modules.Leaderboard.ViewModels;
using client_win.Modules.Leaderboard.Views;
using client_win.Modules.Admin.Services;
using client_win.Modules.About.ViewModels;
using client_win.Modules.About.Views;
using client_win.Modules.Updates;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Game.RoomDirectory.ViewModels;
using client_win.Modules.Game.RoomDirectory.Views;
using client_win.Modules.User.Services;
using client_win.Modules.Network.Services;
using client_win.Modules.MainMenu.Views;
using client_win.Modules.TextPrompts.Services;
using client_win.Modules.Notifications.Services;
using client_win.Modules.Notifications.ViewModels;
using client_win.Modules.Notifications.Views;

namespace client_win.Modules.MainMenu.Services;

/// <summary>
/// Router de navigation pour le menu principal.
/// Se limite à la navigation entre modules UI.
/// </summary>
public sealed class MenuRouter : IMenuRouter
{
    private readonly ILogger<MenuRouter> _logger;
    private readonly IOptionsService _options;
    private readonly IChatLauncher _chat;
    private readonly ICatalogService _catalog;
    private readonly INavigationService _navigation;
    private readonly IMessagingService _messaging;
    private readonly ISocialService _social;
    private readonly IGameTableOpener _tables;
    private readonly IRoomDirectoryClient _roomDirectory;
    private readonly IStatsService _stats;
    private readonly ILeaderboardService _leaderboard;
    private readonly IAdminService _admin;
    private readonly IAdminMaintenanceHttpService _adminMaintenance;
    private readonly IAdminMaintenanceTokenStore _maintenanceTokenStore;
    private readonly ISecretPromptService _secretPrompts;
    private readonly IDialogService _dialogs;
    private readonly IClientUpdatePublisher _publisher;
    private readonly ClientConfiguration _config;
    private readonly ISoundService _sounds;
    private readonly IScreenReaderAnnouncer _screenReader;
    private readonly ISessionService _session;
    private readonly IRemoteSoundCache _remoteSounds;
    private readonly IApiCapabilitiesService _apiCapabilities;
    private readonly INotificationInbox _inbox;
    private readonly INotifyGatewayClient _notify;
    private readonly IMenuBadges _badges;
    private readonly Modules.Presence.Services.IPresenceMonitor _presence;

    public MenuRouter(
        ILogger<MenuRouter> logger,
        ClientConfiguration config,
        IOptionsService options,
        ISoundService sounds,
        IScreenReaderAnnouncer screenReader,
        ISessionService session,
        IRemoteSoundCache remoteSounds,
        IApiCapabilitiesService apiCapabilities,
        INotificationInbox inbox,
        INotifyGatewayClient notify,
        IMenuBadges badges,
        Modules.Presence.Services.IPresenceMonitor presence,
        IChatLauncher chat,
        ICatalogService catalog,
        INavigationService navigation,
        IMessagingService messaging,
        ISocialService social,
        IGameTableOpener tables,
        IRoomDirectoryClient roomDirectory,
        IStatsService stats,
        ILeaderboardService leaderboard,
        IAdminService admin,
        IAdminMaintenanceHttpService adminMaintenance,
        IAdminMaintenanceTokenStore maintenanceTokenStore,
        ISecretPromptService secretPrompts,
        IDialogService dialogs,
        IClientUpdatePublisher publisher)
    {
        _logger = logger;
        _config = config;
        _options = options;
        _sounds = sounds;
        _screenReader = screenReader;
        _session = session;
        _remoteSounds = remoteSounds;
        _apiCapabilities = apiCapabilities;
        _inbox = inbox;
        _notify = notify;
        _badges = badges;
        _presence = presence;
        _chat = chat;
        _catalog = catalog;
        _navigation = navigation;
        _messaging = messaging;
        _social = social;
        _tables = tables;
        _roomDirectory = roomDirectory;
        _stats = stats;
        _leaderboard = leaderboard;
        _admin = admin;
        _adminMaintenance = adminMaintenance;
        _maintenanceTokenStore = maintenanceTokenStore;
        _secretPrompts = secretPrompts;
        _dialogs = dialogs;
        _publisher = publisher;
    }

    private void SetPresenceContextForView(UserControl? view)
    {
        try
        {
            // Table context is handled by GameTableOpener (needs room id/name).
            if (view is client_win.Modules.Game.Shell.Views.GameRoomView)
            {
                return;
            }

            var ctx = view switch
            {
                client_win.Modules.Catalog.Views.CatalogView => "tavern",
                client_win.Modules.Stats.Views.StatsView => "stats",
                client_win.Modules.Social.Views.SocialView => "social",
                client_win.Modules.Messaging.Views.MessagingView => "messaging",
                client_win.Modules.Notifications.Views.NotificationsView => "notifications",
                client_win.Modules.MainMenu.Views.MainMenuView => "home",
                _ => "other"
            };

            _ = _presence.SetContextAsync(ctx);
        }
        catch
        {
            // Best-effort
        }
    }

    public Task<string> OpenCatalog()
    {
        _logger.LogInformation("Ouverture du catalogue de jeux");

        var previous = _navigation.CurrentView;
        var catalogView = new CatalogView();
        StopBackgroundLoops();
        _sounds.StartLoop(Modules.Audio.Models.SoundId.TavernAmbience);
        SetPresenceContextForView(catalogView);
        CatalogViewModel? vm = null;
        vm = new CatalogViewModel(
            _catalog,
            onClose: () =>
            {
                vm?.Dispose();

                if (previous != null)
                {
                    _navigation.Show(previous);
                    RestoreFocusAfterBackNavigation(previous);
                    SetPresenceContextForView(previous);
                }

                StartLoopForView(_navigation.CurrentView);
            },
            openGame: async game =>
            {
                StopBackgroundLoops();
                await _tables.OpenAsync(game, catalogView).ConfigureAwait(true);
            },
            joinGame: async () =>
            {
                StopBackgroundLoops();
                return await JoinGame().ConfigureAwait(true);
            },
            openStoryBook: async () =>
            {
                StopBackgroundLoops();
                return await OpenStats().ConfigureAwait(true);
            });

        catalogView.DataContext = vm;
        _navigation.Show(catalogView);

        return Task.FromResult("Catalogue ouvert.");
    }

    public Task<string> OpenStats()
    {
        _logger.LogInformation("Ouverture du livre des contes");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new StatsView();
        SetPresenceContextForView(view);
        var vm = new StatsViewModel(_stats, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
                SetPresenceContextForView(previous);
            }

            StartLoopForView(_navigation.CurrentView);
        }, openLeaderboard: async () => { await OpenLeaderboard().ConfigureAwait(true); });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Livre des contes ouvert.");
    }

    public Task<string> OpenStatsForUser(int userId, string username)
    {
        _logger.LogInformation("Ouverture du livre des contes de {Username} ({UserId})", username, userId);

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new StatsView();
        SetPresenceContextForView(view);
        var vm = new StatsViewModel(
            _stats,
            onClose: () =>
            {
                if (previous != null)
                {
                    _navigation.Show(previous);
                    RestoreFocusAfterBackNavigation(previous);
                    SetPresenceContextForView(previous);
                }

                StartLoopForView(_navigation.CurrentView);
            },
            openLeaderboard: async () => { await OpenLeaderboard().ConfigureAwait(true); },
            targetUserId: userId,
            targetUsername: username);
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult($"Livre des contes de {username} ouvert.");
    }

    public Task<string> OpenLeaderboard()
    {
        _logger.LogInformation("Ouverture du classement");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new LeaderboardView();
        var vm = new LeaderboardViewModel(_leaderboard, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
            }

            StartLoopForView(_navigation.CurrentView);
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Classement ouvert.");
    }

    public Task<string> JoinGame()
    {
        _logger.LogInformation("Ouverture du navigateur de tables publiques");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new JoinGameView();
        SetPresenceContextForView(view);
        JoinGameViewModel? vm = null;
        vm = new JoinGameViewModel(
            rooms: _roomDirectory,
            tables: _tables,
            screenReader: _screenReader,
            returnView: previous ?? view,
            onClose: () =>
            {
                try { vm?.Dispose(); } catch { /* ignore */ }
                if (previous != null)
                {
                    _navigation.Show(previous);
                    RestoreFocusAfterBackNavigation(previous);
                    SetPresenceContextForView(previous);
                }

                StartLoopForView(_navigation.CurrentView);
            });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Liste des tables publiques ouverte.");
    }

    private static void RestoreFocusAfterBackNavigation(UserControl target)
    {
        // Accessibilité: quand on revient au menu précédent via Échap,
        // remettre le focus sur l'élément sélectionné (NVDA annonce le libellé, comme lors de la navigation au clavier).
        var dispatcher = target.Dispatcher;
        dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.ApplicationIdle, new Action(() =>
        {
            try
            {
                target.UpdateLayout();
                System.Windows.Input.Keyboard.ClearFocus();

                static bool TryFocusList(System.Windows.Controls.ListBox list)
                {
                    if (!list.IsVisible || !list.IsEnabled)
                    {
                        return false;
                    }

                    if (list.Items.Count == 0)
                    {
                        list.Focus();
                        System.Windows.Input.Keyboard.Focus(list);
                        return true;
                    }

                    if (list.SelectedIndex < 0)
                    {
                        list.SelectedIndex = 0;
                    }

                    void FocusSelectedItem()
                    {
                        list.UpdateLayout();
                        list.ScrollIntoView(list.SelectedItem ?? list.Items[list.SelectedIndex]);
                        if (list.ItemContainerGenerator.ContainerFromIndex(list.SelectedIndex) is System.Windows.Controls.ListBoxItem item)
                        {
                            item.Focus();
                            System.Windows.Input.Keyboard.Focus(item);
                            return;
                        }

                        list.Focus();
                        System.Windows.Input.Keyboard.Focus(list);
                    }

                    if (list.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
                    {
                        FocusSelectedItem();
                        return true;
                    }

                    EventHandler? handler = null;
                    handler = (_, __) =>
                    {
                        if (list.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
                        {
                            return;
                        }

                        list.ItemContainerGenerator.StatusChanged -= handler;
                        FocusSelectedItem();
                    };
                    list.ItemContainerGenerator.StatusChanged += handler;
                    return true;
                }

                // Catalog (taverne): revenir sur la catégorie sélectionnée (les actions sont dans la liste).
                if (target.FindName("CategoriesList") is System.Windows.Controls.ListBox categories && TryFocusList(categories))
                {
                    return;
                }
                if (target.FindName("SubCategoriesList") is System.Windows.Controls.ListBox subCategories && TryFocusList(subCategories))
                {
                    return;
                }
                if (target.FindName("GamesList") is System.Windows.Controls.ListBox games && TryFocusList(games))
                {
                    return;
                }

                // MainMenu / Stats / Leaderboard utilisent souvent "ItemsList".
                if (target.FindName("ItemsList") is System.Windows.Controls.ListBox list)
                {
                    if (list.Items.Count == 0)
                    {
                        list.Focus();
                        return;
                    }

                    if (list.SelectedIndex < 0)
                    {
                        list.SelectedIndex = 0;
                    }

                    void FocusSelectedItem()
                    {
                        list.UpdateLayout();
                        list.ScrollIntoView(list.SelectedItem ?? list.Items[list.SelectedIndex]);
                        if (list.ItemContainerGenerator.ContainerFromIndex(list.SelectedIndex) is System.Windows.Controls.ListBoxItem item)
                        {
                            item.Focus();
                            System.Windows.Input.Keyboard.Focus(item);
                            return;
                        }

                        list.Focus();
                        System.Windows.Input.Keyboard.Focus(list);
                    }

                    if (list.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
                    {
                        FocusSelectedItem();
                        return;
                    }

                    EventHandler? handler = null;
                    handler = (_, __) =>
                    {
                        if (list.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
                        {
                            return;
                        }

                        list.ItemContainerGenerator.StatusChanged -= handler;
                        FocusSelectedItem();
                    };
                    list.ItemContainerGenerator.StatusChanged += handler;
                    return;
                }

                // Fallback: focus sur la vue.
                target.Focus();
                System.Windows.Input.Keyboard.Focus(target);
            }
            catch
            {
                // ignore
            }
        }));
    }

    public async Task<string> OpenChat()
    {
        _logger.LogInformation("Ouverture du tchat");

        var owner = Application.Current?.MainWindow;
        if (owner == null)
        {
            _logger.LogWarning("Fenêtre principale indisponible pour le tchat");
            return "Fenêtre principale indisponible.";
        }

        StopBackgroundLoops();
        var status = await _chat.OpenAsync(owner).ConfigureAwait(true);
        StartLoopForView(_navigation.CurrentView);
        return status;
    }

    public Task<string> OpenMessaging()
    {
        _logger.LogInformation("Ouverture de la messagerie");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new MessagingView();
        SetPresenceContextForView(view);
        var vm = new MessagingViewModel(_messaging, _dialogs, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
                SetPresenceContextForView(previous);
            }

            StartLoopForView(_navigation.CurrentView);
        });
        // Depuis Social, Échap doit revenir directement au menu Social.
        vm.CloseOnEscape = previous is SocialView;
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Messagerie ouverte.");
    }

    public Task<string> OpenSocial()
    {
        _logger.LogInformation("Ouverture du réseau social");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new SocialView();
        SetPresenceContextForView(view);
        var vm = new SocialViewModel(
            _social,
            openStoryBook: async (userId, username) =>
            {
                StopBackgroundLoops();
                return await OpenStatsForUser(userId, username).ConfigureAwait(true);
            },
            openMessaging: async () =>
            {
                StopBackgroundLoops();
                return await OpenMessaging().ConfigureAwait(true);
            },
            onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
                SetPresenceContextForView(previous);
            }

            StartLoopForView(_navigation.CurrentView);
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Réseau social ouvert.");
    }

    public Task<string> OpenNotifications()
    {
        _logger.LogInformation("Ouverture des notifications");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new NotificationsView();
        SetPresenceContextForView(view);
        var vm = new NotificationsViewModel(_inbox, _notify, _session, _dialogs, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
                SetPresenceContextForView(previous);
            }

            StartLoopForView(_navigation.CurrentView);
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Notifications ouvertes.");
    }

    public Task<string> OpenContactAdmin()
    {
        _logger.LogInformation("Ouverture du contact admin");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new AboutView();
        var vm = new AboutViewModel(_config, _dialogs, _notify, _sounds, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
            }

            StartLoopForView(_navigation.CurrentView);
        }, openContactAdmin: true);
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Contact admin ouvert.");
    }

    public Task<string> OpenAdmin()
    {
        _logger.LogInformation("Ouverture du panneau d'administration");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new AdminView();
        var vm = new AdminViewModel(_admin, _adminMaintenance, _maintenanceTokenStore, _secretPrompts, _roomDirectory, _apiCapabilities, _config, _publisher, _dialogs, _options, _sounds, _session, _remoteSounds, _tables, view,
            openNotifications: async () =>
            {
                StopBackgroundLoops();
                return await OpenNotifications().ConfigureAwait(true);
            },
            openStoryBookForUser: async (userId, username) =>
            {
                StopBackgroundLoops();
                return await OpenStatsForUser(userId, username).ConfigureAwait(true);
            },
            onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
            }

            StartLoopForView(_navigation.CurrentView);
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Panneau d'administration ouvert.");
    }

    public Task<string> OpenAbout()
    {
        _logger.LogInformation("Ouverture de la page À propos");

        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new AboutView();
        var vm = new AboutViewModel(_config, _dialogs, _notify, _sounds, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
            }

            StartLoopForView(_navigation.CurrentView);
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("À propos ouvert.");
    }

    public Task<string> OpenOptions()
    {
        _logger.LogInformation("Ouverture des options");
        StopBackgroundLoops();
        return OpenOptionsAndRestoreAsync();
    }

    public Task<string> Logout()
    {
        _logger.LogInformation("Déconnexion demandée par l'utilisateur");
        // La déconnexion est gérée par le MainMenuViewModel
        return Task.FromResult("Déconnexion en cours...");
    }

    private async Task<string> OpenOptionsAndRestoreAsync()
    {
        var status = await _options.OpenAsync().ConfigureAwait(true);
        StartLoopForView(_navigation.CurrentView);
        return status;
    }

    private void StopBackgroundLoops()
    {
        _sounds.StopLoop(Modules.Audio.Models.SoundId.MainMenuMusic);
        _sounds.StopLoop(Modules.Audio.Models.SoundId.TavernAmbience);
    }

    private void StartLoopForView(UserControl? view)
    {
        StopBackgroundLoops();
        if (view is CatalogView)
        {
            _sounds.StartLoop(Modules.Audio.Models.SoundId.TavernAmbience);
        }
        else if (view is MainMenuView)
        {
            _sounds.StartLoop(Modules.Audio.Models.SoundId.MainMenuMusic);
        }
    }
}
