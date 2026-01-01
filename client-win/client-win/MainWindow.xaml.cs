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
using System.Threading;
using client_win.Modules.Network.Services;
using System.Windows.Input;
using client_win.Modules.Presence.Services;
using client_win.Modules.Presence.Views;
using client_win.Modules.Updates;
using client_win.Modules.Settings.Services;
using System.ComponentModel;
using client_win.Modules.Audio.Services;
using client_win.Core.Accessibility;

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
        private readonly INotifyListener _notify;
        private readonly IPresenceMonitor _presence;
        private readonly IPresenceLauncher _presenceUi;
        private readonly IOptionsService _options;
        private readonly IHomeViewAccessor _homeAccessor;
        private bool _exitConfirmed;
        private bool _exitPromptOpen;

        public INavigationService Navigation => _navigation;

        public MainWindow()
        {
            InitializeComponent();
            _host = AppBootstrapper.Build(RootHost);
            SpaceKeyAnnouncer.Initialize(_host.Services.GetRequiredService<IScreenReaderAnnouncer>());
            _errorBus = _host.Errors;
            _wsConnection = _host.WsClient;
            _dialogs = _host.Dialogs;
            _notify = _host.Services.GetRequiredService<INotifyListener>();
            _presence = _host.Services.GetRequiredService<IPresenceMonitor>();
            _presenceUi = _host.Services.GetRequiredService<IPresenceLauncher>();
            _options = _host.Services.GetRequiredService<IOptionsService>();
            _homeAccessor = _host.Services.GetRequiredService<IHomeViewAccessor>();

            _homeViewModel = _host.CreateHomeViewModel(OnNavigateToMainMenu, Close);

            _homeView = new HomeView { DataContext = _homeViewModel };
            _navigation = _host.Navigation;
            _errorHandler = new ShellErrorHandler(_errorBus, _navigation, _dialogs, _host.Configuration, () => _homeView, _host.CrashReporter);

            Loaded += OnLoaded;
            PreviewKeyDown += OnPreviewKeyDown;
            Closing += OnClosing;
        }

        private void OnClosing(object? sender, CancelEventArgs e)
        {
            if (_exitConfirmed)
            {
                return;
            }
            if (!_options.Current.ConfirmExit)
            {
                return;
            }

            e.Cancel = true;
            if (_exitPromptOpen)
            {
                return;
            }
            _exitPromptOpen = true;

            // IMPORTANT:
            // Ne pas afficher un dialogue dans le handler Closing, sinon WPF peut considérer la fenêtre "en cours de fermeture"
            // et lever l'exception: "Impossible d'affecter Visible à Visibility... lorsqu'un objet Window est en cours de fermeture."
            Dispatcher.BeginInvoke(async () =>
            {
                try
                {
                    var ok = await _dialogs.Confirm(
                            "Quitter",
                            "Voulez-vous vraiment quitter Le Monde de Lila ?",
                            okText: "Quitter",
                            cancelText: "Annuler")
                        .ConfigureAwait(true);
                    if (ok == true)
                    {
                        _exitConfirmed = true;
                        Application.Current.Shutdown();
                    }
                }
                catch
                {
                    // En cas de problème de dialogue, ne pas bloquer la fermeture.
                    _exitConfirmed = true;
                    Application.Current.Shutdown();
                }
                finally
                {
                    _exitPromptOpen = false;
                }
            });
        }

        private void OnPreviewKeyDown(object sender, KeyEventArgs e)
        {
            var isAlt = (Keyboard.Modifiers & ModifierKeys.Alt) == ModifierKeys.Alt;
            var isCtrl = (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control;
            var key = e.Key == Key.System ? e.SystemKey : e.Key;
            if (isAlt && key == Key.F4)
            {
                e.Handled = true;
                Close();
            }
            else if (isCtrl && key == Key.U)
            {
                e.Handled = true;
                // Empêche d'ouvrir "Présence" depuis "Présence" (sinon boucle et peut figer l'UI).
                if (_navigation.CurrentView is PresenceView)
                {
                    return;
                }

                _ = _presenceUi.OpenAsync(this);
            }
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            _navigation.Show(_homeView);

            // CORRECTION: Ajout de try-catch pour éviter crash silencieux avec async void
            try
            {
                // Laisse l'UI se charger et exécute en parallèle:
                // - init écran d'accueil
                // - check mise à jour (peut fermer l'app si requis)
                var initTask = _homeViewModel.InitializeAsync();
                var updateTask = ClientUpdateStartupPrompt
                    .CheckAndPromptAsync(_host.Configuration, _dialogs);

                var shouldContinue = await updateTask.ConfigureAwait(true);
                if (!shouldContinue)
                {
                    return;
                }

                await initTask.ConfigureAwait(true);
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
            // Précharge le catalogue dès la connexion (best-effort) pour éviter un blocage
            // si l'utilisateur ouvre le catalogue immédiatement.
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
            _ = _host.Services.GetRequiredService<Modules.Catalog.Services.ICatalogService>().PreloadAsync(cts.Token);
            _ = _host.Services.GetRequiredService<IRemoteSoundCache>().RefreshAsync();
            _ = _notify.StartAsync();
            _ = _presence.StartAsync();
            // Warm-up WS room to avoid cold handshake latency when creating/joining a table.
            try
            {
                using var warmCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                _ = _host.Services
                    .GetRequiredService<Modules.Game.Room.Services.IRoomGatewayClient>()
                    .WarmUpAsync(warmCts.Token);
            }
            catch
            {
                // ignore (best-effort)
            }
            var menuVm = _host.CreateMainMenuViewModel(user, OnLogoutRequested);
            var menuView = new MainMenuView { DataContext = menuVm };
            _homeAccessor.HomeView = menuView;
            _navigation.Show(menuView);

            // Musique de fond du menu principal (configurable côté admin via sons globaux).
            var sounds = _host.Services.GetRequiredService<ISoundService>();
            sounds.StopLoop(Modules.Audio.Models.SoundId.TavernAmbience);
            sounds.StartLoop(Modules.Audio.Models.SoundId.MainMenuMusic);
        }

        private void OnLogoutRequested()
        {
            _ = _notify.StopAsync();
            _ = _presence.StopAsync();
            try
            {
                var sounds = _host.Services.GetRequiredService<ISoundService>();
                sounds.StopLoop(Modules.Audio.Models.SoundId.MainMenuMusic);
                sounds.StopLoop(Modules.Audio.Models.SoundId.TavernAmbience);
            }
            catch
            {
                // ignore
            }
            _host.Session.Clear();
            _navigation.ClearUser();
            Title = "Le Monde de Lila";
            _homeAccessor.HomeView = null;
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
