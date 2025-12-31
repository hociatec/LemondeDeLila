using System.Threading.Tasks;
using System.Windows;
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
    private readonly IDialogService _dialogs;
    private readonly IClientUpdatePublisher _publisher;
    private readonly ClientConfiguration _config;
    private readonly ISoundService _sounds;

    public MenuRouter(
        ILogger<MenuRouter> logger,
        ClientConfiguration config,
        IOptionsService options,
        ISoundService sounds,
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
        IDialogService dialogs,
        IClientUpdatePublisher publisher)
    {
        _logger = logger;
        _config = config;
        _options = options;
        _sounds = sounds;
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
        _dialogs = dialogs;
        _publisher = publisher;
    }

    public Task<string> OpenCatalog()
    {
        _logger.LogInformation("Ouverture du catalogue de jeux");

        var previous = _navigation.CurrentView;
        var catalogView = new CatalogView();
        var vm = new CatalogViewModel(_catalog, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        },
        openGame: game => _tables.OpenAsync(game, previous ?? catalogView));

        catalogView.DataContext = vm;
        _navigation.Show(catalogView);

        return Task.FromResult("Catalogue ouvert.");
    }

    public Task<string> OpenStats()
    {
        _logger.LogInformation("Ouverture du livre des contes");

        var previous = _navigation.CurrentView;
        var view = new StatsView();
        var vm = new StatsViewModel(_stats, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        }, openLeaderboard: async () => { await OpenLeaderboard().ConfigureAwait(true); });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Livre des contes ouvert.");
    }

    public Task<string> OpenLeaderboard()
    {
        _logger.LogInformation("Ouverture du classement");

        var previous = _navigation.CurrentView;
        var view = new LeaderboardView();
        var vm = new LeaderboardViewModel(_leaderboard, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Classement ouvert.");
    }

    public Task<string> JoinGame()
    {
        _logger.LogInformation("Ouverture du navigateur de tables publiques");

        var previous = _navigation.CurrentView;
        var view = new JoinGameView();
        JoinGameViewModel? vm = null;
        vm = new JoinGameViewModel(
            rooms: _roomDirectory,
            tables: _tables,
            returnView: previous ?? view,
            onClose: () =>
            {
                try { vm?.Dispose(); } catch { /* ignore */ }
                if (previous != null)
                {
                    _navigation.Show(previous);
                }
            });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Liste des tables publiques ouverte.");
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

        return await _chat.OpenAsync(owner);
    }

    public Task<string> OpenMessaging()
    {
        _logger.LogInformation("Ouverture de la messagerie");

        var previous = _navigation.CurrentView;
        var view = new MessagingView();
        var vm = new MessagingViewModel(_messaging, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Messagerie ouverte.");
    }

    public Task<string> OpenSocial()
    {
        _logger.LogInformation("Ouverture du réseau social");

        var previous = _navigation.CurrentView;
        var view = new SocialView();
        var vm = new SocialViewModel(_social, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Réseau social ouvert.");
    }

    public Task<string> OpenAdmin()
    {
        _logger.LogInformation("Ouverture du panneau d'administration");

        var previous = _navigation.CurrentView;
        var view = new AdminView();
        var vm = new AdminViewModel(_admin, _config, _publisher, _dialogs, _options, _sounds, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("Panneau d'administration ouvert.");
    }

    public Task<string> OpenAbout()
    {
        _logger.LogInformation("Ouverture de la page À propos");

        var previous = _navigation.CurrentView;
        var view = new AboutView();
        var vm = new AboutViewModel(_config, _dialogs, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        });
        view.DataContext = vm;
        _navigation.Show(view);

        return Task.FromResult("À propos ouvert.");
    }

    public Task<string> OpenOptions()
    {
        _logger.LogInformation("Ouverture des options");
        return _options.OpenAsync();
    }

    public Task<string> Logout()
    {
        _logger.LogInformation("Déconnexion demandée par l'utilisateur");
        // La déconnexion est gérée par le MainMenuViewModel
        return Task.FromResult("Déconnexion en cours...");
    }
}
