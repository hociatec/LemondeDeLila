using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using client_win.Modules.Settings.Services;
using client_win.Modules.Chat.Services;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Catalog.ViewModels;
using client_win.Modules.Catalog.Views;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Social.ViewModels;
using client_win.Modules.Social.Views;
using client_win.Modules.Social.Services;
using client_win.Modules.Admin.ViewModels;
using client_win.Modules.Admin.Views;
using client_win.Modules.Shell.Services;
using System.Windows;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Messaging.ViewModels;
using client_win.Modules.Messaging.Views;
using client_win.Modules.Game.Room.ViewModels;
using client_win.Modules.Game.Room.Views;

namespace client_win.Modules.MainMenu.Services;

/// <summary>
/// Router de navigation pour le menu principal.
/// Gère la navigation vers toutes les fonctionnalités de l'application.
/// </summary>
public sealed class MenuRouter : IMenuRouter
{
    private readonly ILogger<MenuRouter> _logger;
    private readonly IOptionsService _options;
    private readonly IChatLauncher _chat;
    private readonly ICatalogService _catalog;
    private readonly INavigationService _navigation;
    private readonly IDialogService _dialogs;
    private readonly IMessagingService _messaging;
    private readonly ISocialService _social;

    public MenuRouter(
        ILogger<MenuRouter> logger,
        IOptionsService options,
        IChatLauncher chat,
        ICatalogService catalog,
        INavigationService navigation,
        IDialogService dialogs,
        IMessagingService messaging,
        ISocialService social)
    {
        _logger = logger;
        _options = options;
        _chat = chat;
        _catalog = catalog;
        _navigation = navigation;
        _dialogs = dialogs;
        _messaging = messaging;
        _social = social;
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
        openGame: game =>
        {
            OpenGameTable(game, catalogView);
            return Task.CompletedTask;
        });
        catalogView.DataContext = vm;
        _navigation.Show(catalogView);

        return Task.FromResult("Catalogue ouvert.");
    }

    public Task<string> JoinGame()
    {
        _logger.LogInformation("Fonction JoinGame non disponible (module Game retiré)");
        return Task.FromResult("Fonction JoinGame non disponible.");
    }

    public async Task<string> OpenChat()
    {
        _logger.LogInformation("Ouverture du chat");

        var owner = Application.Current?.MainWindow;
        if (owner == null)
        {
            _logger.LogWarning("Fenêtre principale indisponible pour le chat");
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
        var vm = new AdminViewModel(onClose: () =>
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

    private void OpenGameTable(CatalogGame game, System.Windows.Controls.UserControl returnView)
    {
        var tableView = new GameRoomView();
        var tableVm = new GameRoomViewModel(game, onQuit: () =>
        {
            _navigation.Show(returnView);
            return Task.CompletedTask;
        }, dialogs: _dialogs);
        tableView.DataContext = tableVm;
        _navigation.Show(tableView);
    }
}
