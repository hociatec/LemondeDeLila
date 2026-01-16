using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Input;
using client_win.Core.Accessibility;
using client_win.Modules.Audio.Services;
using client_win.Modules.Config;
using client_win.Modules.Home.Views;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Network.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.User.Models;
using Microsoft.Extensions.DependencyInjection;

namespace client_win
{
    public partial class MainWindow : Window
    {
        private readonly AppHost _host;
        private readonly INavigationService _navigation;
        private readonly HomeView _homeView;

        private readonly ShellErrorHandler _errorHandler;
        private readonly ShellStartupController _startup;
        private readonly ShellSessionController _session;
        private readonly ShellInputController _input;
        private readonly ShellCloseCoordinator _close;
        private readonly NavigationAudioSync _audioSync;

        public INavigationService Navigation => _navigation;

        public MainWindow()
        {
            InitializeComponent();

            _host = AppBootstrapper.Build(RootHost);
            SpaceKeyAnnouncer.Initialize(_host.Services.GetRequiredService<IScreenReaderAnnouncer>());

            var dialogs = _host.Dialogs;
            var options = _host.Services.GetRequiredService<IOptionsService>();
            var notify = _host.Services.GetRequiredService<INotifyListener>();
            var presence = _host.Services.GetRequiredService<IPresenceMonitor>();
            var presenceUi = _host.Services.GetRequiredService<IPresenceLauncher>();
            var homeAccessor = _host.Services.GetRequiredService<IHomeViewAccessor>();
            var menuRouter = _host.Services.GetRequiredService<IMenuRouter>();
            var audio = _host.Services.GetRequiredService<IAppAudioCoordinator>();

            var homeViewModel = _host.CreateHomeViewModel(OnNavigateToMainMenu, Close);
            _homeView = new HomeView { DataContext = homeViewModel };
            _navigation = _host.Navigation;

            _audioSync = new NavigationAudioSync(_navigation, audio);
            _errorHandler = new ShellErrorHandler(_host.Errors, _navigation, dialogs, _host.Configuration, () => _homeView, _host.CrashReporter);
            _startup = new ShellStartupController(_navigation, homeViewModel, _homeView, _host.Configuration, dialogs, _host.Errors);
            _session = new ShellSessionController(_host, _navigation, homeAccessor, notify, presence, audio);
            _input = new ShellInputController(presence, presenceUi, _navigation, menuRouter);
            _close = new ShellCloseCoordinator(dialogs, options, audio);

            Loaded += OnLoaded;
            PreviewKeyDown += OnPreviewKeyDown;
            PreviewMouseDown += OnPreviewMouseDown;
            Closing += OnClosing;
            Activated += OnActivated;
        }

        private void OnClosing(object? sender, CancelEventArgs e) =>
            _close.OnClosing(() => _host?.Session?.CurrentUser != null, e);

        private void OnPreviewKeyDown(object sender, KeyEventArgs e) =>
            _input.OnPreviewKeyDown(this, e);

        private void OnPreviewMouseDown(object sender, MouseButtonEventArgs e) =>
            _input.OnPreviewMouseDown(e);

        private void OnActivated(object? sender, EventArgs e) =>
            _input.OnActivated();

        private async void OnLoaded(object sender, RoutedEventArgs e) =>
            await _startup.OnLoadedAsync().ConfigureAwait(true);

        private async void OnNavigateToMainMenu(AuthenticatedUser user)
        {
            Title = $"Le Monde de Lila - Connecte en tant que {user.Username}";
            try
            {
                await _session.NavigateToMainMenuAsync(user, OnLogoutRequested).ConfigureAwait(true);
            }
            catch
            {
                // ignore (best-effort)
            }
        }

        private void OnLogoutRequested()
        {
            Title = "Le Monde de Lila";
            _session.LogoutToHome(_homeView);
        }

        protected override async void OnClosed(EventArgs e)
        {
            try { _audioSync.Dispose(); } catch { /* ignore */ }
            _errorHandler.Dispose();
            await _host.DisposeAsync();
            base.OnClosed(e);
        }
    }
}

