using System;
using System.Diagnostics;
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
using client_win.Modules.Audio.Models;
using System.Windows.Threading;

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
        private int _soundInitRevision;
        private long _lastClientDisconnectedSoundTicks;

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

            var isLoggedIn = _host?.Session?.CurrentUser != null;
            var shouldConfirm = _options.Current.ConfirmExit;
            if (!shouldConfirm && !isLoggedIn)
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
                    if (shouldConfirm)
                    {
                        var ok = await _dialogs.Confirm(
                                "Quitter",
                                "Voulez-vous vraiment quitter Le Monde de Lila ?",
                                okText: "Quitter",
                                cancelText: "Annuler")
                            .ConfigureAwait(true);
                        if (ok != true)
                        {
                            return;
                        }
                    }

                    if (isLoggedIn)
                    {
                        // Stopper les boucles (menu/taverne) avant de jouer le son de fermeture,
                        // sinon on entend les deux en même temps.
                        try
                        {
                            if (_host is not null)
                            {
                                Interlocked.Increment(ref _soundInitRevision);
                                var sounds = _host.Services.GetRequiredService<ISoundService>();
                                sounds.StopLoop(Modules.Audio.Models.SoundId.MainMenuMusic);
                                sounds.StopLoop(Modules.Audio.Models.SoundId.TavernAmbience);
                            }
                        }
                        catch
                        {
                            // ignore
                        }

                        // L'app va se fermer: laisser le temps au son de se terminer (avec un plafond)
                        // sinon MediaPlayer est coupé par Shutdown.
                        await PlayClientDisconnectedSoundAndWaitAsync(TimeSpan.FromSeconds(4)).ConfigureAwait(true);
                    }

                    _exitConfirmed = true;
                    Application.Current?.Shutdown();
                }
                catch
                {
                    // En cas de problème de dialogue/son, ne pas bloquer la fermeture.
                    _exitConfirmed = true;
                    Application.Current?.Shutdown();
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

        private async void OnNavigateToMainMenu(AuthenticatedUser user)
        {
            Title = $"Le Monde de Lila - Connecté en tant que {user.Username}";
            _navigation.SetUser(new UserContext(user.Username, user.Token));
            _host.Session.SetUser(user);

            // Rafraîchir le cache des sons distants avant de jouer le son de connexion
            // pour s'assurer d'utiliser le son uploadé par l'admin (si disponible).
            try
            {
                var remote = _host.Services.GetRequiredService<IRemoteSoundCache>();
                // Timeout court (1 seconde) pour ne pas bloquer l'UX si le serveur est lent.
                var soundRefreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(1));
                _ = remote
                    .RefreshAsync(force: true, cancellationToken: soundRefreshCts.Token)
                    .ContinueWith(
                        _ => soundRefreshCts.Dispose(),
                        CancellationToken.None,
                        TaskContinuationOptions.ExecuteSynchronously,
                        TaskScheduler.Default);
            }
            catch
            {
                // ignore - utilisera le son par défaut local
            }

            // Son "connexion réussie" au moment exact où l'authentification est validée.
            // (Le transport WS peut se connecter avant/après, ce qui donne une latence perceptible.)
            try
            {
                var sounds = _host.Services.GetRequiredService<ISoundService>();
                // Éviter le BeginInvoke ici: on est déjà sur le thread UI, et ça ajoute une latence perceptible.
                // Précharger + warm-up pour réduire au maximum la latence du tout premier play.
                sounds.Preload(SoundId.ClientConnected, warmUp: true);
                sounds.Play(SoundId.ClientConnected);
            }
            catch
            {
                // ignore
            }
            // Précharge le catalogue dès la connexion (best-effort) pour éviter un blocage
            // si l'utilisateur ouvre le catalogue immédiatement.
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
            _ = _host.Services.GetRequiredService<Modules.Catalog.Services.ICatalogService>().PreloadAsync(cts.Token);
            _ = EnsureSoundsReadyAndApplyLoopsAsync();
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

            // Capabilities (best-effort): allow the client to avoid unsupported WS routes.
            try
            {
                _ = _host.Services
                    .GetRequiredService<Modules.Network.Services.IApiCapabilitiesService>()
                    .GetAsync();
            }
            catch
            {
                // ignore
            }
            var menuVm = _host.CreateMainMenuViewModel(user, OnLogoutRequested);
            var menuView = new MainMenuView { DataContext = menuVm };
            _homeAccessor.HomeView = menuView;
            _navigation.Show(menuView);

            // Musique de fond du menu principal :
            // laisser le son de connexion se terminer avant de démarrer la boucle (meilleure UX).
            _ = StartMainMenuMusicAfterConnectAsync();
        }

        private void OnLogoutRequested()
        {
            Interlocked.Increment(ref _soundInitRevision);
            _ = _notify.StopAsync();
            _ = _presence.StopAsync();
            try
            {
                var sounds = _host.Services.GetRequiredService<ISoundService>();
                TryPlayClientDisconnectedSound(sounds);
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

        private void TryPlayClientDisconnectedSound(ISoundService sounds)
        {
            // Évite les doubles lectures si un transport déclenche aussi le son (ex: WS disconnect) au même moment.
            var minGapTicks = (long)(Stopwatch.Frequency * 0.9);
            var now = Stopwatch.GetTimestamp();
            var prev = Interlocked.Read(ref _lastClientDisconnectedSoundTicks);
            if (prev != 0 && (now - prev) < minGapTicks)
            {
                return;
            }

            Interlocked.Exchange(ref _lastClientDisconnectedSoundTicks, now);

            try
            {
                sounds.Preload(SoundId.ClientDisconnected);
                sounds.Play(SoundId.ClientDisconnected);
            }
            catch
            {
                // ignore
            }
        }

        private async Task PlayClientDisconnectedSoundAndWaitAsync(TimeSpan timeout)
        {
            try
            {
                var sounds = _host.Services.GetRequiredService<ISoundService>();
                TryPlayClientDisconnectedSound(sounds);
                await sounds.WaitForSoundToEndAsync(SoundId.ClientDisconnected, timeout).ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
        }

        private async Task EnsureSoundsReadyAndApplyLoopsAsync()
        {
            var revision = Interlocked.Increment(ref _soundInitRevision);
            var remote = _host.Services.GetRequiredService<IRemoteSoundCache>();
            var sounds = _host.Services.GetRequiredService<ISoundService>();

            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(12));
                // Ne pas forcer le refresh s'il vient d'être fait dans OnNavigateToMainMenu
                await remote.RefreshAsync(force: false, cancellationToken: cts.Token).ConfigureAwait(false);
            }
            catch
            {
                // ignore (best-effort)
            }

            if (revision != Volatile.Read(ref _soundInitRevision))
            {
                return;
            }

            try
            {
                // Éviter de recharger les MediaPlayer pendant que le son "connexion" joue,
                // sinon un refresh des sons distants peut couper la lecture en cours.
                await sounds.WaitForSoundToEndAsync(SoundId.ClientConnected, TimeSpan.FromSeconds(4)).ConfigureAwait(false);

                sounds.PreloadAll();

                // Rejouer la boucle selon la vue courante pour prendre en compte les sons distants nouvellement téléchargés.
                var view = _navigation.CurrentView;
                sounds.StopLoop(Modules.Audio.Models.SoundId.MainMenuMusic);
                sounds.StopLoop(Modules.Audio.Models.SoundId.TavernAmbience);
                if (view is MainMenuView)
                {
                    _ = StartMainMenuMusicAfterConnectAsync();
                }
                else if (view is Modules.Catalog.Views.CatalogView)
                {
                    sounds.StartLoop(Modules.Audio.Models.SoundId.TavernAmbience);
                }
            }
            catch
            {
                // ignore (best-effort)
            }
        }

        private async Task StartMainMenuMusicAfterConnectAsync()
        {
            var revision = Volatile.Read(ref _soundInitRevision);
            var sounds = _host.Services.GetRequiredService<ISoundService>();

            try
            {
                // Ne pas laisser une ancienne boucle couvrir le son de connexion.
                sounds.StopLoop(SoundId.MainMenuMusic);
                sounds.StopLoop(SoundId.TavernAmbience);

                // Attendre que le son "connexion" (s'il joue) se termine.
                await sounds.WaitForSoundToEndAsync(SoundId.ClientConnected, TimeSpan.FromSeconds(4)).ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }

            await Dispatcher.InvokeAsync(() =>
            {
                // Annulé si navigation/déconnexion entre temps.
                if (revision != Volatile.Read(ref _soundInitRevision))
                {
                    return;
                }
                if (_navigation.CurrentView is not MainMenuView)
                {
                    return;
                }

                sounds.StopLoop(SoundId.TavernAmbience);
                sounds.StartLoop(SoundId.MainMenuMusic);
            }, DispatcherPriority.Background);
        }

        protected override async void OnClosed(EventArgs e)
        {
            _errorHandler.Dispose();
            await _host.DisposeAsync();
            base.OnClosed(e);
        }
    }
}
