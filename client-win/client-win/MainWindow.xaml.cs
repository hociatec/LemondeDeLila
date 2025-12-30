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
using client_win.Modules.Updates;
using client_win.Core;

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
        private bool _startupUpdateChecked;

        public INavigationService Navigation => _navigation;

        public MainWindow()
        {
            InitializeComponent();
            _host = AppBootstrapper.Build(RootHost);
            _errorBus = _host.Errors;
            _wsConnection = _host.WsClient;
            _dialogs = _host.Dialogs;
            _notify = _host.Services.GetRequiredService<INotifyListener>();

            _homeViewModel = _host.CreateHomeViewModel(OnNavigateToMainMenu, Close);

            _homeView = new HomeView { DataContext = _homeViewModel };
            _navigation = _host.Navigation;
            _errorHandler = new ShellErrorHandler(_errorBus, _navigation, _dialogs, () => _homeView, _host.CrashReporter);

            Loaded += OnLoaded;
            PreviewKeyDown += OnPreviewKeyDown;
        }

        private void OnPreviewKeyDown(object sender, KeyEventArgs e)
        {
            var isAlt = (Keyboard.Modifiers & ModifierKeys.Alt) == ModifierKeys.Alt;
            var key = e.Key == Key.System ? e.SystemKey : e.Key;
            if (isAlt && key == Key.F4)
            {
                e.Handled = true;
                Close();
            }
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            _navigation.Show(_homeView);

            // CORRECTION: Ajout de try-catch pour éviter crash silencieux avec async void
            try
            {
                _ = CheckForUpdateOnStartupAsync();
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

        private async Task CheckForUpdateOnStartupAsync()
        {
            if (_startupUpdateChecked)
            {
                return;
            }
            _startupUpdateChecked = true;

            // Ne pas gêner le dev : les mises à jour ClickOnce ne s'appliquent pas sous dotnet run.
            if (UpdateEnvironment.IsRunningUnderDotnetHost())
            {
                return;
            }

            // Si ce n'est pas une installation ClickOnce, on ne propose pas automatiquement ici.
            if (!UpdateEnvironment.IsLikelyClickOnceInstall())
            {
                return;
            }

            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                var publisher = _host.Services.GetRequiredService<IClientUpdatePublisher>();
                var latest = await publisher.GetLatestPublishedVersionAsync(cts.Token).ConfigureAwait(true);
                if (string.IsNullOrWhiteSpace(latest))
                {
                    return;
                }

                var current = TryParseVersion(AppInfo.GetShortVersion());
                var available = TryParseVersion(latest);
                if (current == null || available == null || available <= current)
                {
                    return;
                }

                var confirm = await _dialogs.Confirm(
                        "Mise à jour",
                        $"Une mise à jour est disponible ({latest}).\n\nInstaller maintenant ?")
                    .ConfigureAwait(true);
                if (confirm != true)
                {
                    return;
                }

                var restarted = UpdateRestartHelper.RestartCurrentProcess("startup-check");
                if (!restarted)
                {
                    await _dialogs.ShowInfo(
                            "Mise à jour",
                            "Le redémarrage automatique a été annulé ou bloqué par Windows.\n\n" +
                            "Ferme puis relance l'application depuis le menu Démarrer pour appliquer la mise à jour.")
                        .ConfigureAwait(true);
                }
            }
            catch
            {
                // Best-effort : pas de popup d'erreur au démarrage si le réseau est indisponible.
            }
        }

        private static Version? TryParseVersion(string? value)
        {
            var raw = (value ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(raw))
            {
                return null;
            }

            var parts = raw.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length is < 1 or > 4)
            {
                return null;
            }

            int[] nums = new int[4];
            for (int i = 0; i < parts.Length; i++)
            {
                if (!int.TryParse(parts[i], out var n) || n < 0)
                {
                    return null;
                }
                nums[i] = n;
            }

            return new Version(nums[0], nums[1], nums[2], nums[3]);
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
            _ = _notify.StartAsync();
            var menuVm = _host.CreateMainMenuViewModel(user, OnLogoutRequested);
            var menuView = new MainMenuView { DataContext = menuVm };
            _navigation.Show(menuView);
        }

        private void OnLogoutRequested()
        {
            _ = _notify.StopAsync();
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
