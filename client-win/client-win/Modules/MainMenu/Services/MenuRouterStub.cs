using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Extensions.Logging;
using client_win.Modules.Chat.Services;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Catalog.ViewModels;
using client_win.Modules.Catalog.Views;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Messaging.ViewModels;
using client_win.Modules.Messaging.Views;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Game.RoomDirectory.ViewModels;
using client_win.Modules.Game.RoomDirectory.Views;

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
    private readonly IRoomDirectoryClient _roomDirectory;
    private readonly IScreenReaderAnnouncer _screenReader;

    public MenuRouterStub(
        ILogger<MenuRouterStub> logger,
        IOptionsService options,
        IScreenReaderAnnouncer screenReader,
        IChatLauncher chat,
        ICatalogService catalog,
        INavigationService navigation,
        IMessagingService messaging,
        IGameTableOpener tables,
        IRoomDirectoryClient roomDirectory)
    {
        _logger = logger;
        _options = options;
        _screenReader = screenReader;
        _chat = chat;
        _catalog = catalog;
        _navigation = navigation;
        _messaging = messaging;
        _tables = tables;
        _roomDirectory = roomDirectory;
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

    public Task<string> JoinGame()
    {
        var previous = _navigation.CurrentView;
        var view = new JoinGameView();
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
                }
            });
        view.DataContext = vm;
        _navigation.Show(view);
        return Task.FromResult("Liste des tables publiques ouverte.");
    }

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
                RestoreFocusAfterBackNavigation(previous);
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

    private static void RestoreFocusAfterBackNavigation(UserControl target)
    {
        var dispatcher = target.Dispatcher;
        dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.ApplicationIdle, new Action(() =>
        {
            try
            {
                target.UpdateLayout();
                System.Windows.Input.Keyboard.ClearFocus();

                if (target.FindName("ItemsList") is ListBox list)
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

                    list.UpdateLayout();
                    list.ScrollIntoView(list.SelectedItem ?? list.Items[list.SelectedIndex]);
                    list.Focus();
                    System.Windows.Input.Keyboard.Focus(list);
                    return;
                }

                target.Focus();
                System.Windows.Input.Keyboard.Focus(target);
            }
            catch
            {
                // ignore
            }
        }));
    }
}
