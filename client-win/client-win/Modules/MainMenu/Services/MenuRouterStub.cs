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
using client_win.Modules.Catalog.Views;
using client_win.Modules.MainMenu.Views;
using client_win.Modules.Audio.Models;

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
    private readonly Modules.Audio.Services.ISoundService? _sounds;

    public MenuRouterStub(
        ILogger<MenuRouterStub> logger,
        IOptionsService options,
        IScreenReaderAnnouncer screenReader,
        Modules.Audio.Services.ISoundService sounds,
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
        _sounds = sounds;
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
        StopBackgroundLoops();
        _sounds?.StartLoop(SoundId.TavernAmbience);
        var vm = new CatalogViewModel(
            _catalog,
            onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
            }

            StartLoopForView(previous);
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

    public Task<string> OpenStats() => LogAndReturn("Livre des contes (stub)");

    public Task<string> OpenLeaderboard() => LogAndReturn("Classement (stub)");

    public Task<string> JoinGame()
    {
        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
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
                    RestoreFocusAfterBackNavigation(previous);
                }

                StartLoopForView(previous);
            });
        view.DataContext = vm;
        _navigation.Show(view);
        return Task.FromResult("Liste des tables publiques ouverte.");
    }

    public async Task<string> OpenChat()
    {
        var owner = Application.Current?.MainWindow;
        if (owner == null) return "Fenêtre principale indisponible.";
        StopBackgroundLoops();
        var status = await _chat.OpenAsync(owner).ConfigureAwait(true);
        StartLoopForView(_navigation.CurrentView);
        return status;
    }

    public Task<string> OpenMessaging()
    {
        var previous = _navigation.CurrentView;
        StopBackgroundLoops();
        var view = new MessagingView();
        var vm = new MessagingViewModel(_messaging, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
                RestoreFocusAfterBackNavigation(previous);
            }

            StartLoopForView(previous);
        });
        view.DataContext = vm;
        _navigation.Show(view);
        return Task.FromResult("Messagerie ouverte.");
    }

    private void StopBackgroundLoops()
    {
        _sounds?.StopLoop(SoundId.MainMenuMusic);
        _sounds?.StopLoop(SoundId.TavernAmbience);
    }

    private void StartLoopForView(UserControl? view)
    {
        StopBackgroundLoops();
        if (_sounds == null)
        {
            return;
        }

        if (view is CatalogView)
        {
            _sounds.StartLoop(SoundId.TavernAmbience);
        }
        else if (view is MainMenuView)
        {
            _sounds.StartLoop(SoundId.MainMenuMusic);
        }
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

                    void FocusSelectedItem()
                    {
                        list.UpdateLayout();
                        list.ScrollIntoView(list.SelectedItem ?? list.Items[list.SelectedIndex]);
                        if (list.ItemContainerGenerator.ContainerFromIndex(list.SelectedIndex) is ListBoxItem item)
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
