using System.Threading.Tasks;
using System.Windows;
using Microsoft.Extensions.Logging;
using client_win.Modules.Chat.Services;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Catalog.ViewModels;
using client_win.Modules.Catalog.Views;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Messaging.ViewModels;
using client_win.Modules.Messaging.Views;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.MainMenu.Services;

/// <summary>
/// Router stub qui enregistre les intentions et renvoie un statut.
/// </summary>
public sealed class MenuRouterStub : IMenuRouter
{
    private readonly ILogger<MenuRouterStub> _logger;
    private readonly IOptionsService _options;
    private readonly IChatLauncher _chat;
    private readonly ICatalogService _catalog;
    private readonly INavigationService _navigation;
    private readonly IMessagingService _messaging;
    private readonly IGameTableOpener _tables;

    public MenuRouterStub(
        ILogger<MenuRouterStub> logger,
        IOptionsService options,
        IChatLauncher chat,
        ICatalogService catalog,
        INavigationService navigation,
        IMessagingService messaging,
        IGameTableOpener tables)
    {
        _logger = logger;
        _options = options;
        _chat = chat;
        _catalog = catalog;
        _navigation = navigation;
        _messaging = messaging;
        _tables = tables;
    }

    public Task<string> OpenCatalog()
    {
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

    public Task<string> OpenStats() => LogAndReturn("Livre des contes (stub)");

    public Task<string> OpenLeaderboard() => LogAndReturn("Classement (stub)");

    public Task<string> JoinGame() => LogAndReturn("Rejoindre une partie (stub)");

    public async Task<string> OpenChat()
    {
        var owner = Application.Current?.MainWindow;
        if (owner == null) return "Fenêtre principale indisponible.";
        return await _chat.OpenAsync(owner);
    }

    public Task<string> OpenMessaging()
    {
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

    public Task<string> OpenSocial() => LogAndReturn("Social (stub)");

    public Task<string> OpenAdmin() => LogAndReturn("Administration (stub)");

    public Task<string> OpenAbout() => LogAndReturn("À propos (stub)");

    public Task<string> OpenOptions() => _options.OpenAsync();

    public Task<string> Logout() => LogAndReturn("Déconnexion...");

    private Task<string> LogAndReturn(string message)
    {
        _logger.LogInformation(message);
        return Task.FromResult(message);
    }
}
