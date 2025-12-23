using System;
using System.Windows;
using client_win.Modules.Config;
using client_win.Modules.Error;
using client_win.Modules.Network;
using client_win.Modules.User.Services;
using client_win.Modules.User.Models;
using System.Threading.Tasks;
using client_win.Modules.Home.ViewModels;
using client_win.Modules.Home.Views;
using client_win.Modules.MainMenu.ViewModels;
using client_win.Modules.MainMenu.Views;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Shell.Services;
using Microsoft.Extensions.DependencyInjection;

namespace client_win
{
    public partial class MainWindow : Window
    {
        private readonly AppHost _host;
        private readonly HomeViewModel _homeViewModel;
        private readonly INavigationService _navigation;
        private readonly IDialogService _dialogs;
        private readonly HomeView _homeView;
        private readonly ErrorBus _errorBus;
        private readonly PersistentWsClient _wsConnection;
        private readonly ShellErrorHandler _errorHandler;

        public INavigationService Navigation => _navigation;

        public MainWindow()
        {
            InitializeComponent();
            _host = AppBootstrapper.Build(RootHost);
            _errorBus = _host.Errors;
            _wsConnection = _host.WsClient;
            _dialogs = _host.Dialogs;

            _homeViewModel = _host.CreateHomeViewModel(OnNavigateToMainMenu, Close);

            _homeView = new HomeView { DataContext = _homeViewModel };
            _navigation = _host.Navigation;
            _errorHandler = new ShellErrorHandler(_errorBus, _navigation, _dialogs, () => _homeView);

            Loaded += OnLoaded;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            _navigation.Show(_homeView);

            // CORRECTION: Ajout de try-catch pour éviter crash silencieux avec async void
            try
            {
                await _homeViewModel.InitializeAsync();
            }
            catch (Exception ex)
            {
                _errorBus.Publish(new AppError(
                    "Erreur lors de l'initialisation de l'application.",
                    ErrorSeverity.Error,
                    context: "app.startup",
                    detail: ex.Message));
            }
        }

        private void OnNavigateToMainMenu(AuthenticatedUser user)
        {
            Title = $"Le Monde de Lila - Connecté en tant que {user.Username}";
            _navigation.SetUser(new UserContext(user.Username, user.Token));
            _host.Session.SetUser(user);
            var menuVm = _host.CreateMainMenuViewModel(user, OnLogoutRequested);
            var menuView = new MainMenuView { DataContext = menuVm };
            _navigation.Show(menuView);
        }

        private void OnLogoutRequested()
        {
            _host.Session.Clear();
            _navigation.ClearUser();
            Title = "Le Monde de Lila";
            _navigation.Show(_homeView);
        }

        protected override async void OnClosed(EventArgs e)
        {
            _errorHandler.Dispose();
            await _host.DisposeAsync();
            base.OnClosed(e);
        }
    }
}
