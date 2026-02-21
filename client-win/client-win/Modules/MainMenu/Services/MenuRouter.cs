using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Extensions.Logging;
using client_win.Core.Diagnostics;
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
using client_win.Modules.Audio.Models;
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
using client_win.Modules.Vault.Services;
using client_win.Modules.Vault.ViewModels;

namespace client_win.Modules.MainMenu.Services;

/// <summary>
/// Router de navigation pour le menu principal.
/// Se limite Ã  la navigation entre modules UI.
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
    private readonly IAppAudioCoordinator _audio;
    private readonly IScreenReaderAnnouncer _screenReader;
    private readonly IAnnouncementService _announcements;
    private readonly ISessionService _session;
    private readonly IRemoteSoundCache _remoteSounds;
    private readonly IApiCapabilitiesService _apiCapabilities;
    private readonly INotificationInbox _inbox;
    private readonly INotifyGatewayClient _notify;
    private readonly IMenuBadges _badges;
    private readonly Modules.Presence.Services.IPresenceMonitor _presence;
    private readonly IVaultClient _vault;
    private bool _contactAdminOpen;
    private AdminViewModel? _adminVm;
    private object? _adminReturnContent;

    private CatalogViewModel? _catalogVm;
    private object? _catalogReturnContent;

    private VaultViewModel? _vaultVm;
    private object? _vaultReturnContent;

    private StatsViewModel? _statsVm;
    private object? _statsReturnContent;

    private LeaderboardViewModel? _leaderboardVm;
    private object? _leaderboardReturnContent;

    private MessagingViewModel? _messagingVm;
    private object? _messagingReturnContent;

    private SocialViewModel? _socialVm;
    private object? _socialReturnContent;

    private NotificationsViewModel? _notificationsVm;
    private object? _notificationsReturnContent;

    private AboutViewModel? _aboutVm;
    private object? _aboutReturnContent;

    public MenuRouter(
        ILogger<MenuRouter> logger,
        ClientConfiguration config,
        IOptionsService options,
        ISoundService sounds,
        IAppAudioCoordinator audio,
        IScreenReaderAnnouncer screenReader,
        IAnnouncementService announcements,
        ISessionService session,
        IRemoteSoundCache remoteSounds,
        IApiCapabilitiesService apiCapabilities,
        INotificationInbox inbox,
        INotifyGatewayClient notify,
        IMenuBadges badges,
        Modules.Presence.Services.IPresenceMonitor presence,
        IVaultClient vault,
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
        _audio = audio;
        _screenReader = screenReader;
        _announcements = announcements;
        _session = session;
        _remoteSounds = remoteSounds;
        _apiCapabilities = apiCapabilities;
        _inbox = inbox;
        _notify = notify;
        _badges = badges;
        _presence = presence;
        _vault = vault ?? throw new ArgumentNullException(nameof(vault));
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

    private void SetPresenceContextForContent(object? content)
    {
        try
        {
            // Table context is handled by GameTableOpener (needs room id/name).
            if (content is client_win.Modules.Game.Shell.Views.GameRoomView)
            {
                return;
            }

            var ctx = content switch
            {
                client_win.Modules.Catalog.ViewModels.CatalogViewModel => "tavern",
                client_win.Modules.Stats.ViewModels.StatsViewModel => "stats",
                client_win.Modules.Social.ViewModels.SocialViewModel => "social",
                client_win.Modules.Messaging.ViewModels.MessagingViewModel => "messaging",
                client_win.Modules.Notifications.ViewModels.NotificationsViewModel => "notifications",
                client_win.Modules.MainMenu.ViewModels.MainMenuViewModel => "home",
                client_win.Modules.Vault.ViewModels.VaultViewModel => "tavern",
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

        var previous = _navigation.CurrentContent;
        _catalogReturnContent = previous;

        if (_catalogVm == null)
        {
            _catalogVm = new CatalogViewModel(
                _catalog,
                _options,
                _session,
                onClose: () =>
                {
                    var returnTo = _catalogReturnContent;
                    _catalogReturnContent = null;
                    if (returnTo != null)
                    {
                        _navigation.Show(returnTo);
                        SetPresenceContextForContent(returnTo);
                    }
                },
                openGame: async game =>
                {
                    if (_catalogVm == null) return;
                    await _tables.OpenAsync(game, _catalogVm).ConfigureAwait(true);
                },
                joinGame: async () => await JoinGame().ConfigureAwait(true),
                openStoryBook: async () => await OpenStats().ConfigureAwait(true),
                openVault: async () => await OpenVault().ConfigureAwait(true));
        }

        SetPresenceContextForContent(_catalogVm);
        _navigation.Show(_catalogVm);

        return Task.FromResult("Catalogue ouvert.");
    }

    public Task<string> OpenVault()
    {
        _logger.LogInformation("Ouverture de Mon coffre fort");

        var previous = _navigation.CurrentContent;
        if (previous == null)
        {
            return Task.FromResult("Impossible d'ouvrir Mon coffre fort (vue prÃ©cÃ©dente indisponible).");
        }

        _vaultReturnContent = previous;
        if (_vaultVm == null)
        {
            _vaultVm = new VaultViewModel(
                _vault,
                _tables,
                _dialogs,
                _announcements,
                returnContent: () => _vaultReturnContent,
                onClose: () =>
                {
                    var returnTo = _vaultReturnContent;
                    _vaultReturnContent = null;
                    if (returnTo != null)
                    {
                        _navigation.Show(returnTo);
                        SetPresenceContextForContent(returnTo);
                    }
                });
        }

        SetPresenceContextForContent(_vaultVm);
        _navigation.Show(_vaultVm);
        return Task.FromResult("Mon coffre fort ouvert.");
    }

    public Task<string> OpenStats()
    {
        _logger.LogInformation("Ouverture du livre des contes");

        var previous = _navigation.CurrentContent;
        _statsReturnContent = previous;
        if (_statsVm == null)
        {
            _statsVm = new StatsViewModel(
                _stats,
                onClose: () =>
                {
                    var returnTo = _statsReturnContent;
                    _statsReturnContent = null;
                    if (returnTo != null)
                    {
                        _navigation.Show(returnTo);
                        SetPresenceContextForContent(returnTo);
                    }
                },
                openLeaderboard: async () => { await OpenLeaderboard().ConfigureAwait(true); },
                cacheable: true);
        }

        SetPresenceContextForContent(_statsVm);
        _navigation.Show(_statsVm);

        return Task.FromResult("Livre des contes ouvert.");
    }

    public Task<string> OpenStatsForUser(int userId, string username)
    {
        _logger.LogInformation("Ouverture du livre des contes de {Username} ({UserId})", username, userId);

        var previous = _navigation.CurrentContent;
        var vm = new StatsViewModel(
            _stats,
            onClose: () =>
            {
                if (previous != null)
                {
                    _navigation.Show(previous);
                    SetPresenceContextForContent(previous);
                }
            },
            openLeaderboard: async () => { await OpenLeaderboard().ConfigureAwait(true); },
            targetUserId: userId,
            targetUsername: username,
            cacheable: false);
        SetPresenceContextForContent(vm);
        _navigation.Show(vm);

        return Task.FromResult($"Livre des contes de {username} ouvert.");
    }

    public Task<string> OpenLeaderboard()
    {
        _logger.LogInformation("Ouverture du classement");

        var previous = _navigation.CurrentContent;
        _leaderboardReturnContent = previous;
        if (_leaderboardVm == null)
        {
            _leaderboardVm = new LeaderboardViewModel(_leaderboard, onClose: () =>
            {
                var returnTo = _leaderboardReturnContent;
                _leaderboardReturnContent = null;
                if (returnTo != null)
                {
                    _navigation.Show(returnTo);
                    SetPresenceContextForContent(returnTo);
                }
            });
        }

        SetPresenceContextForContent(_leaderboardVm);
        _navigation.Show(_leaderboardVm);

        return Task.FromResult("Classement ouvert.");
    }

    public Task<string> JoinGame()
    {
        _logger.LogInformation("Ouverture du navigateur de tables publiques");

        var previous = _navigation.CurrentContent;
        JoinGameViewModel? vm = null;
        vm = new JoinGameViewModel(
            rooms: _roomDirectory,
            tables: _tables,
            announcements: _announcements,
            // Quitter une table via raccourci (Q) doit revenir Ã  la taverne (menu prÃ©cÃ©dent),
            // pas nÃ©cessairement Ã  la liste des tables.
            returnContent: () => previous ?? vm,
            onClose: () =>
            {
                try { vm?.Dispose(); } catch { /* ignore */ }
                if (previous != null)
                {
                    _navigation.Show(previous);
                    SetPresenceContextForContent(previous);
                }
            });
        SetPresenceContextForContent(vm);
        _navigation.Show(vm);

        return Task.FromResult("Liste des tables publiques ouverte.");
    }


    public async Task<string> OpenChat()
    {
        _logger.LogInformation("Ouverture du tchat");

        var owner = Application.Current?.MainWindow;
        if (owner == null)
        {
            _logger.LogWarning("FenÃªtre principale indisponible pour le tchat");
            return "FenÃªtre principale indisponible.";
        }

        _audio.PauseBackground();
        try
        {
            return await _chat.OpenAsync(owner).ConfigureAwait(true);
        }
        finally
        {
            _audio.ResumeBackground();
        }
    }

    public Task<string> OpenMessaging()
    {
        _logger.LogInformation("Ouverture de la messagerie");

        var previous = _navigation.CurrentContent;
        _messagingReturnContent = previous;
        if (_messagingVm == null)
        {
            _messagingVm = new MessagingViewModel(_messaging, _dialogs, onClose: () =>
            {
                var returnTo = _messagingReturnContent;
                _messagingReturnContent = null;
                if (returnTo != null)
                {
                    if (returnTo is client_win.Modules.Social.ViewModels.SocialViewModel socialVm)
                    {
                        socialVm.RequestReturnToMenu();
                    }
                    _navigation.Show(returnTo);
                    SetPresenceContextForContent(returnTo);
                }
            });
        }

        SetPresenceContextForContent(_messagingVm);
        _navigation.Show(_messagingVm);

        return Task.FromResult("Messagerie ouverte.");
    }

    public Task<string> OpenSocial()
    {
        _logger.LogInformation("Ouverture du rÃ©seau social");

        var previous = _navigation.CurrentContent;
        _socialReturnContent = previous;
        if (_socialVm == null)
        {
            _socialVm = new SocialViewModel(
                _social,
                openStoryBook: async (userId, username) => await OpenStatsForUser(userId, username).ConfigureAwait(true),
                openMessaging: async () => await OpenMessaging().ConfigureAwait(true),
                onClose: () =>
                {
                    var returnTo = _socialReturnContent;
                    _socialReturnContent = null;
                    if (returnTo != null)
                    {
                        _navigation.Show(returnTo);
                        SetPresenceContextForContent(returnTo);
                    }
                });
        }

        SetPresenceContextForContent(_socialVm);
        _navigation.Show(_socialVm);

        return Task.FromResult("RÃ©seau social ouvert.");
    }

    public Task<string> OpenNotifications()
    {
        _logger.LogInformation("Ouverture des notifications");

        var previous = _navigation.CurrentContent;
        _notificationsReturnContent = previous;
        if (_notificationsVm == null)
        {
            _notificationsVm = new NotificationsViewModel(_inbox, _notify, _session, _dialogs, onClose: () =>
            {
                var returnTo = _notificationsReturnContent;
                _notificationsReturnContent = null;
                if (returnTo != null)
                {
                    _navigation.Show(returnTo);
                    SetPresenceContextForContent(returnTo);
                }
            });
        }

        SetPresenceContextForContent(_notificationsVm);
        _navigation.Show(_notificationsVm);

        return Task.FromResult("Notifications ouvertes.");
    }

    public Task<string> OpenContactAdmin()
    {
        _logger.LogInformation("Ouverture du contact admin");

        if (_contactAdminOpen && _navigation.CurrentContent is AboutViewModel)
        {
            return Task.FromResult("Contact admin dÃ©jÃ  ouvert.");
        }

        var previous = _navigation.CurrentContent;
        _contactAdminOpen = true;
        var vm = new AboutViewModel(_config, _dialogs, _notify, _sounds, onClose: () =>
        {
            _contactAdminOpen = false;
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        }, openContactAdmin: true);
        _navigation.Show(vm);

        return Task.FromResult("Contact admin ouvert.");
    }

    public Task<string> OpenAdmin()
    {
        _logger.LogInformation("Ouverture du panneau d'administration");

        var perfStart = PerfTrace.Start();

        if (_navigation.CurrentContent is AdminViewModel)
        {
            return Task.FromResult("Panneau d'administration dÃ©jÃ  ouvert.");
        }

        _adminReturnContent = _navigation.CurrentContent;

        if (_adminVm == null)
        {
            _adminVm = new AdminViewModel(
                _admin,
                _adminMaintenance,
                _maintenanceTokenStore,
                _secretPrompts,
                _roomDirectory,
                _apiCapabilities,
                _config,
                _publisher,
                _dialogs,
                _options,
                _sounds,
                _session,
                _remoteSounds,
                _tables,
                returnContent: () => _adminVm,
                openNotifications: async () => await OpenNotifications().ConfigureAwait(true),
                openStoryBookForUser: async (userId, username) => await OpenStatsForUser(userId, username).ConfigureAwait(true),
                onClose: () =>
                {
                    var previous = _adminReturnContent;
                    _adminReturnContent = null;
                    if (previous != null)
                    {
                        _navigation.Show(previous);
                        SetPresenceContextForContent(previous);
                    }
                });
        }

        try { _adminVm.ShowRootMenu(); } catch { /* ignore */ }

        PerfTrace.Mark("menu.openAdmin.vmReady", perfStart);
        _navigation.Show(_adminVm);
        PerfTrace.Mark("menu.openAdmin.navigated", perfStart);

        return Task.FromResult("Panneau d'administration ouvert.");
    }

    public Task<string> OpenAbout()
    {
        _logger.LogInformation("Ouverture de la page Ã€ propos");

        var previous = _navigation.CurrentContent;
        _aboutReturnContent = previous;
        if (_aboutVm == null)
        {
            _aboutVm = new AboutViewModel(_config, _dialogs, _notify, _sounds, onClose: () =>
            {
                var returnTo = _aboutReturnContent;
                _aboutReturnContent = null;
                if (returnTo != null)
                {
                    _navigation.Show(returnTo);
                    SetPresenceContextForContent(returnTo);
                }
            });
        }

        SetPresenceContextForContent(_aboutVm);
        _navigation.Show(_aboutVm);

        return Task.FromResult("Ã€ propos ouvert.");
    }

    public Task<string> OpenOptions()
    {
        _logger.LogInformation("Ouverture des options");
        _audio.PauseBackground();
        return OpenOptionsAndRestoreAsync();
    }

    public object[] WarmUpShellPages()
    {
        var warmed = new System.Collections.Generic.List<object>(capacity: 12);

        try
        {
            if (_catalogVm == null)
            {
                _catalogVm = new CatalogViewModel(
                    _catalog,
                    _options,
                    _session,
                    onClose: () =>
                    {
                        var returnTo = _catalogReturnContent;
                        _catalogReturnContent = null;
                        if (returnTo != null)
                        {
                            _navigation.Show(returnTo);
                            SetPresenceContextForContent(returnTo);
                        }
                    },
                    openGame: async game =>
                    {
                        if (_catalogVm == null) return;
                        await _tables.OpenAsync(game, _catalogVm).ConfigureAwait(true);
                    },
                    joinGame: async () => await JoinGame().ConfigureAwait(true),
                    openStoryBook: async () => await OpenStats().ConfigureAwait(true),
                    openVault: async () => await OpenVault().ConfigureAwait(true));
            }

            if (_catalogVm != null) warmed.Add(_catalogVm);
        }
        catch
        {
            // best-effort
        }

        try
        {
            if (_statsVm == null)
            {
                _statsVm = new StatsViewModel(
                    _stats,
                    onClose: () =>
                    {
                        var returnTo = _statsReturnContent;
                        _statsReturnContent = null;
                        if (returnTo != null)
                        {
                            _navigation.Show(returnTo);
                            SetPresenceContextForContent(returnTo);
                        }
                    },
                    openLeaderboard: async () => { await OpenLeaderboard().ConfigureAwait(true); },
                    cacheable: true);
            }

            if (_statsVm != null) warmed.Add(_statsVm);
        }
        catch
        {
            // best-effort
        }

        try
        {
            if (_leaderboardVm == null)
            {
                _leaderboardVm = new LeaderboardViewModel(_leaderboard, onClose: () =>
                {
                    var returnTo = _leaderboardReturnContent;
                    _leaderboardReturnContent = null;
                    if (returnTo != null)
                    {
                        _navigation.Show(returnTo);
                        SetPresenceContextForContent(returnTo);
                    }
                });
            }

            if (_leaderboardVm != null) warmed.Add(_leaderboardVm);
        }
        catch
        {
            // best-effort
        }

        try
        {
            if (_vaultVm == null)
            {
                _vaultVm = new VaultViewModel(
                    _vault,
                    _tables,
                    _dialogs,
                    _announcements,
                    returnContent: () => _vaultReturnContent,
                    onClose: () =>
                    {
                        var returnTo = _vaultReturnContent;
                        _vaultReturnContent = null;
                        if (returnTo != null)
                        {
                            _navigation.Show(returnTo);
                            SetPresenceContextForContent(returnTo);
                        }
                    });
            }

            _ = _vaultVm.InitializeAsync();
            if (_vaultVm != null) warmed.Add(_vaultVm);
        }
        catch
        {
            // best-effort
        }

        try
        {
            if (_socialVm == null)
            {
                _socialVm = new SocialViewModel(
                    _social,
                    openStoryBook: async (userId, username) => await OpenStatsForUser(userId, username).ConfigureAwait(true),
                    openMessaging: async () => await OpenMessaging().ConfigureAwait(true),
                    onClose: () =>
                    {
                        var returnTo = _socialReturnContent;
                        _socialReturnContent = null;
                        if (returnTo != null)
                        {
                            _navigation.Show(returnTo);
                            SetPresenceContextForContent(returnTo);
                        }
                    });
            }

            if (_socialVm != null) warmed.Add(_socialVm);
        }
        catch
        {
            // best-effort
        }

        try
        {
            if (_messagingVm == null)
            {
                _messagingVm = new MessagingViewModel(_messaging, _dialogs, onClose: () =>
                {
                    var returnTo = _messagingReturnContent;
                    _messagingReturnContent = null;
                    if (returnTo != null)
                    {
                        if (returnTo is client_win.Modules.Social.ViewModels.SocialViewModel socialVm)
                        {
                            socialVm.RequestReturnToMenu();
                        }
                        _navigation.Show(returnTo);
                        SetPresenceContextForContent(returnTo);
                    }
                });
            }

            if (_messagingVm != null) warmed.Add(_messagingVm);
        }
        catch
        {
            // best-effort
        }

        try
        {
            if (_notificationsVm == null)
            {
                _notificationsVm = new NotificationsViewModel(_inbox, _notify, _session, _dialogs, onClose: () =>
                {
                    var returnTo = _notificationsReturnContent;
                    _notificationsReturnContent = null;
                    if (returnTo != null)
                    {
                        _navigation.Show(returnTo);
                        SetPresenceContextForContent(returnTo);
                    }
                });
            }

            _ = _notificationsVm.InitializeAsync();
            if (_notificationsVm != null) warmed.Add(_notificationsVm);
        }
        catch
        {
            // best-effort
        }

        try
        {
            if (_aboutVm == null)
            {
                _aboutVm = new AboutViewModel(_config, _dialogs, _notify, _sounds, onClose: () =>
                {
                    var returnTo = _aboutReturnContent;
                    _aboutReturnContent = null;
                    if (returnTo != null)
                    {
                        _navigation.Show(returnTo);
                        SetPresenceContextForContent(returnTo);
                    }
                });
            }

            if (_aboutVm != null) warmed.Add(_aboutVm);
        }
        catch
        {
            // best-effort
        }

        return warmed.ToArray();
    }

    public Task<string> Logout()
    {
        _logger.LogInformation("DÃ©connexion demandÃ©e par l'utilisateur");
        _adminVm = null;
        _adminReturnContent = null;
        _contactAdminOpen = false;

        try { _catalogVm?.Dispose(); } catch { /* ignore */ }
        _catalogVm = null;
        _catalogReturnContent = null;

        try { _vaultVm?.Dispose(); } catch { /* ignore */ }
        _vaultVm = null;
        _vaultReturnContent = null;

        _statsVm = null;
        _statsReturnContent = null;

        _leaderboardVm = null;
        _leaderboardReturnContent = null;

        _messagingVm = null;
        _messagingReturnContent = null;

        _socialVm = null;
        _socialReturnContent = null;

        _notificationsVm = null;
        _notificationsReturnContent = null;

        _aboutVm = null;
        _aboutReturnContent = null;
        // La dÃ©connexion est gÃ©rÃ©e par le MainMenuViewModel
        return Task.FromResult("DÃ©connexion en cours...");
    }

    private async Task<string> OpenOptionsAndRestoreAsync()
    {
        try
        {
            return await _options.OpenAsync().ConfigureAwait(true);
        }
        finally
        {
            _audio.ResumeBackground();
        }
    }

}


