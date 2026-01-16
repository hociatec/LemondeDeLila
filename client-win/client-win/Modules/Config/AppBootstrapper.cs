using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Serilog;
using client_win.Modules.Error;
using client_win.Modules.Network;
using client_win.Modules.Network.Services;
using client_win.Modules.Home.ViewModels;
using client_win.Modules.MainMenu.ViewModels;
using client_win.Modules.User.Services;
using client_win.Modules.User.Models;
using client_win.Modules.Shell.Services;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.Settings.Models;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Chat.Services;
using client_win.Modules.Chat.Views;
using client_win.Core;
using client_win.Core.Logging;
using client_win.Core.Diagnostics;
using client_win.Core.Network;
using client_win.Core.Settings;
using client_win.Core.Constants;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Social.Services;
using client_win.Modules.Stats.Services;
using client_win.Modules.Notifications.Services;
using client_win.Modules.Admin.Services;
using client_win.Modules.Leaderboard.Services;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Updates;
using client_win.Modules.Updates.Services;
using client_win.Modules.Audio.Services;

namespace client_win.Modules.Config;

/// <summary>
/// Construit les dépendances principales de l'application (config, réseau, navigation, auth).
/// Permet de garder MainWindow léger et remplaçable.
/// </summary>
public static class AppBootstrapper
{
    public static AppHost Build(ContentControl rootHost, bool testConnectivity = true)
    {
        if (rootHost == null) throw new ArgumentNullException(nameof(rootHost));

        // 1. Initialiser AppData et logging en premier
        var baseDir = AppContext.BaseDirectory;
        var environment = EnvironmentDetector.GetEnvironment();
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName);
        Directory.CreateDirectory(appDataPath);

        // Logs centralisés: toujours dans %LOCALAPPDATA%\LeMondeDeLila\log (debug facile après restart/updates).
        // Si LOG_PATH est fourni, on le garde en "chemin principal" et on mirror aussi vers AppData.
        var appLogsPath = Path.Combine(appDataPath, "log");
        var configuredLogsPath = Environment.GetEnvironmentVariable("LOG_PATH");

        string? legacyLogsPath = null;
        if (environment == EnvironmentDetector.AppEnvironment.Development)
        {
            var repoRoot = TryFindRepoRoot();
            if (!string.IsNullOrWhiteSpace(repoRoot))
            {
                legacyLogsPath = Path.Combine(repoRoot, "client-win", "client", "log");
            }
        }
        if (string.IsNullOrWhiteSpace(legacyLogsPath))
        {
            legacyLogsPath = environment == EnvironmentDetector.AppEnvironment.Development
                ? Path.Combine(Directory.GetCurrentDirectory(), "client", "log")
                : Path.Combine(baseDir, "client", "log");
        }

        if (!string.IsNullOrWhiteSpace(configuredLogsPath))
        {
            LoggingConfiguration.ConfigureLogger(configuredLogsPath, mirrorLogsPath: appLogsPath);
        }
        else
        {
            LoggingConfiguration.ConfigureLogger(appLogsPath, mirrorLogsPath: legacyLogsPath);
        }

        // Best-effort hygiene: ClickOnce can duplicate desktop shortcuts on updates ("(1)/(2)").
        DesktopShortcutDeduplicator.DeduplicateBestEffort();

        // 2. Détecter environnement et valider exigences de production
        Log.Information("Environnement détecté: {Environment}", environment);

        // 3. Charger configuration réseau et applicative (avant validation prod, car la config peut venir du fichier).
        var config = ClientConfiguration.Load();
        var networkConfig = NetworkConfiguration.Load();
        Log.Information("Configuration réseau: {NetworkConfig}", networkConfig);

        // 4. Créer services d'infrastructure
        var errors = new ErrorBus();
        var crashReporter = new CrashReporter(appDataPath);
        var networkMonitor = new NetworkStateMonitor();
        var settingsManager = new SettingsManager<OptionsState>(appDataPath);
        var screenReaderAnnouncer = new ScreenReaderAnnouncer();

        // Pare-chocs global: évite les fermetures WPF sur exception non gérée.
        GlobalExceptionShield.Initialize(errors, crashReporter, screenReaderAnnouncer);
        // 5. Test de connectivité optionnel (ne doit pas bloquer l'affichage du client).
        if (testConnectivity && ShouldTestConnectivity())
        {
            StartConnectivityTestInBackground(config, errors);
        }

        // 6. Configuration DI avec Serilog
        var services = new ServiceCollection();
        services.AddLogging(builder =>
        {
            builder.ClearProviders();
            builder.AddSerilog(dispose: false); // Serilog géré manuellement
        });

        // Enregistrement des configurations et services d'infrastructure
        services.AddSingleton(config);
        services.AddSingleton(networkConfig);
        services.AddSingleton(errors);
        services.AddSingleton(crashReporter);
        services.AddSingleton(networkMonitor);
        services.AddSingleton(settingsManager);

        // Enregistrement des services UI
        services.AddSingleton(rootHost);
        services.AddSingleton<INavigationService>(_ => new NavigationService(rootHost));
        services.AddSingleton<Modules.Shell.Services.IHomeViewAccessor, Modules.Shell.Services.HomeViewAccessor>();
        services.AddSingleton<IDialogService, WpfDialogService>();
        services.AddSingleton<IScreenReaderAnnouncer>(screenReaderAnnouncer);
        services.AddSingleton<IAnnouncementService>(sp =>
            new ScreenReaderAnnouncementService(
                sp.GetRequiredService<IScreenReaderAnnouncer>(),
                sp.GetRequiredService<Dispatcher>(),
                sp.GetRequiredService<ILogger<ScreenReaderAnnouncementService>>()));
        services.AddTransient<IRoomAnnouncements, RoomAnnouncements>();

        // Enregistrement des services réseau avec NetworkConfiguration
        services.AddSingleton<PersistentWsClient>(sp => new PersistentWsClient(
            config.ApiGatewayWs,
            errors,
            sp.GetRequiredService<NetworkConfiguration>().SendTimeoutSeconds,
            sp.GetRequiredService<NetworkConfiguration>().ReceiveTimeoutSeconds,
            sp.GetRequiredService<NetworkConfiguration>(),
            sp.GetRequiredService<NetworkStateMonitor>()));

        services.AddSingleton<WsRequestClient>(sp => new WsRequestClient(
            sp.GetRequiredService<PersistentWsClient>(),
            sp.GetRequiredService<Modules.Network.Services.IWsTicketProvider>(),
            errors));

        services.AddSingleton<Modules.Network.Services.IApiCapabilitiesService>(sp =>
            new Modules.Network.Services.ApiCapabilitiesService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
                sp.GetRequiredService<PersistentWsClient>()));

        // JWT: validation locale via clé publique (RS256). Ne jamais embarquer de secret (HS256).
        services.AddSingleton<JwtTokenValidator>(sp => new JwtTokenValidator(
            sp.GetRequiredService<ClientConfiguration>()));

        // Services d'authentification
        services.AddSingleton<WsAuthenticationService>(sp => new WsAuthenticationService(
            sp.GetRequiredService<WsRequestClient>(),
            sp.GetRequiredService<ILogger<WsAuthenticationService>>(),
            errors,
            sp.GetRequiredService<JwtTokenValidator>()));

        services.AddSingleton<ICredentialStore>(_ => new ErrorAwareCredentialStore(
            new ProtectedCredentialStore(),
            errors));

        services.AddSingleton<ISessionService, SessionService>();
        services.AddSingleton<IWsTicketProvider, WsTicketProvider>();
        services.AddSingleton<client_win.Core.Network.IApiHttpClient, client_win.Core.Network.ApiHttpClient>();
        services.AddSingleton<client_win.Modules.Admin.Services.IAdminMaintenanceHttpService, client_win.Modules.Admin.Services.AdminMaintenanceHttpService>();
        services.AddSingleton<client_win.Modules.Admin.Services.IAdminMaintenanceTokenStore, client_win.Modules.Admin.Services.AdminMaintenanceTokenStore>();

        services.AddSingleton<IClientUpdatePublisher, ClientUpdatePublisher>();

        // OptionsService (dans le shell) avec SettingsManager + Navigation
        services.AddSingleton<IOptionsService>(sp => new OptionsService(
            sp.GetRequiredService<SettingsManager<OptionsState>>(),
            sp.GetRequiredService<INavigationService>(),
            sp.GetRequiredService<ClientConfiguration>(),
            sp.GetRequiredService<IDialogService>()));

        services.AddSingleton<Dispatcher>(_ => Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher);

        services.AddSingleton<IRemoteSoundCache>(sp =>
            new RemoteSoundCache(
                sp.GetRequiredService<ClientConfiguration>(),
                sp.GetRequiredService<ILogger<RemoteSoundCache>>()));

        services.AddSingleton<ISoundService>(sp =>
            new SoundService(
                sp.GetRequiredService<IOptionsService>(),
                sp.GetRequiredService<IRemoteSoundCache>(),
                sp.GetRequiredService<Dispatcher>(),
                sp.GetRequiredService<ILogger<SoundService>>()));

        services.AddSingleton<Modules.Audio.Services.IAppAudioCoordinator>(sp =>
            new Modules.Audio.Services.AppAudioCoordinator(
                sp.GetRequiredService<ISoundService>(),
                sp.GetRequiredService<IRemoteSoundCache>(),
                sp.GetRequiredService<ILogger<Modules.Audio.Services.AppAudioCoordinator>>()));

        // Services métier
        services.AddSingleton<ICatalogService>(sp =>
            new CatalogService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
                errors));

        services.AddTransient<IWebSocketConnection, WebSocketConnection>();

        services.AddSingleton<IRoomGatewayClient>(sp =>
            new RoomGatewayClient(
                sp.GetRequiredService<ClientConfiguration>(),
                sp.GetRequiredService<ISessionService>(),
                () => sp.GetRequiredService<IWebSocketConnection>(),
                sp.GetRequiredService<Modules.Network.Services.IWsTicketProvider>()));

        services.AddSingleton<Modules.Game.RoomDirectory.Services.IRoomDirectoryClient>(sp =>
            new Modules.Game.RoomDirectory.Services.RoomDirectoryClient(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
                sp.GetRequiredService<ISoundService>(),
                sp.GetRequiredService<PersistentWsClient>()));

        services.AddSingleton<IGameGatewayClient>(sp =>
            new GameGatewayClient(
                sp.GetRequiredService<ClientConfiguration>(),
                sp.GetRequiredService<ISessionService>(),
                () => sp.GetRequiredService<IWebSocketConnection>(),
                sp.GetRequiredService<Modules.Network.Services.IWsTicketProvider>()));

        services.AddSingleton<Modules.Presence.Services.IPresenceMonitor>(sp =>
            new Modules.Presence.Services.PresenceMonitor(
                sp.GetRequiredService<ClientConfiguration>(),
                sp.GetRequiredService<ISessionService>(),
                () => sp.GetRequiredService<IWebSocketConnection>(),
                sp.GetRequiredService<Dispatcher>(),
                sp.GetRequiredService<Modules.Network.Services.IWsTicketProvider>()));

        services.AddSingleton<Modules.TextPrompts.Services.ITextPromptService, Modules.TextPrompts.Services.TextPromptService>();
        services.AddSingleton<Modules.TextPrompts.Services.ISecretPromptService, Modules.TextPrompts.Services.SecretPromptService>();

        services.AddSingleton<Modules.Presence.Services.IPresenceLauncher>(sp =>
            new Modules.Presence.Services.PresenceLauncher(
                sp,
                sp.GetRequiredService<INavigationService>(),
                sp.GetRequiredService<ISessionService>()));

        services.AddTransient<IGameTableOpener, GameTableOpener>();

        services.AddSingleton<IChatService>(sp =>
            new ChatService(
                BuildPresenceEndpoint(config),
                sp.GetRequiredService<IWebSocketConnection>(),
                sp.GetRequiredService<IOptionsService>(),
                sp.GetRequiredService<ISessionService>(),
                sp.GetRequiredService<Dispatcher>(),
                sp.GetRequiredService<ISoundService>(),
                sp.GetRequiredService<Modules.Network.Services.IWsTicketProvider>()));

        services.AddSingleton<IChatLauncher, ChatLauncher>();

        services.AddSingleton<IMessagingService>(sp =>
            new MessagingService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
                sp.GetRequiredService<ISoundService>(),
                errors));

        services.AddSingleton<ISocialService>(sp =>
            new SocialService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
                sp.GetRequiredService<ISoundService>(),
                errors));

        services.AddSingleton<IStatsService>(sp =>
            new StatsService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>()));

        services.AddSingleton<ILeaderboardService>(sp =>
            new LeaderboardService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>()));

        services.AddSingleton<IAdminService>(sp =>
            new AdminService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>()));

        services.AddSingleton<Modules.MainMenu.Services.IMenuBadges, Modules.MainMenu.Services.MenuBadges>();
        services.AddSingleton<INotificationInbox, NotificationInbox>();

        services.AddSingleton<NotifyListener>(sp =>
            new NotifyListener(
                sp.GetRequiredService<ClientConfiguration>(),
                sp.GetRequiredService<ISessionService>(),
                () => sp.GetRequiredService<IWebSocketConnection>(),
                sp.GetRequiredService<Modules.Network.Services.IWsTicketProvider>(),
                sp.GetRequiredService<IScreenReaderAnnouncer>(),
                sp.GetRequiredService<IAnnouncementService>(),
                sp.GetRequiredService<Modules.Catalog.Services.ICatalogService>(),
                sp.GetRequiredService<IDialogService>(),
                sp.GetRequiredService<Modules.Game.RoomDirectory.Services.IRoomDirectoryClient>(),
                sp.GetRequiredService<Modules.Game.Shell.Services.IGameTableOpener>(),
                sp.GetRequiredService<INavigationService>(),
                sp.GetRequiredService<ISoundService>(),
                sp.GetRequiredService<IRemoteSoundCache>(),
                sp.GetRequiredService<Modules.Audio.Services.IAppAudioCoordinator>(),
                sp.GetRequiredService<INotificationInbox>(),
                sp.GetRequiredService<Modules.MainMenu.Services.IMenuBadges>()));

        services.AddSingleton<INotifyListener>(sp => sp.GetRequiredService<NotifyListener>());
        services.AddSingleton<INotifyGatewayClient>(sp => sp.GetRequiredService<NotifyListener>());

        services.AddTransient<IMenuRouter, MenuRouter>();

        var provider = services.BuildServiceProvider();

        // Préparer le son de démarrage et lancer le reste en arrière-plan (réduit la latence sans ralentir le démarrage).
        // Best-effort: ne doit jamais empêcher le démarrage.
        try
        {
            var sounds = provider.GetRequiredService<ISoundService>();
            var dispatcher = provider.GetRequiredService<Dispatcher>();
            var session = provider.GetRequiredService<ISessionService>();
            var audio = provider.GetRequiredService<Modules.Audio.Services.IAppAudioCoordinator>();

            // Essayer de récupérer les sons configurés par l'admin avant le son de démarrage,
            // pour que ClientOpened utilise le son serveur dès le premier lancement.
            try
            {
                audio.NotifyAppOpened();
            }
            catch
            {
                // ignore - utilisera le son local par défaut si indisponible
            }

            // Son de démarrage (si activé dans Options).

            // WPF: MediaPlayer.Open/MediaOpened dépend souvent du message loop.
            // Planifier le warm-up des sons "connexion" dès que l'UI est réellement prête,
            // pour éviter une latence perceptible sur la première connexion.
            _ = dispatcher.BeginInvoke((Action)(() =>
            {
                sounds.Preload(Modules.Audio.Models.SoundId.ClientConnected, warmUp: true);
                sounds.Preload(Modules.Audio.Models.SoundId.ClientDisconnected, warmUp: true);
            }), DispatcherPriority.Send);

            // Précharge le reste en arrière-plan pour ne pas bloquer le rendu initial.
            _ = dispatcher.BeginInvoke((Action)(() => sounds.PreloadAll()), DispatcherPriority.Background);

            // Sons de connexion/déconnexion au WS API (si activé).
            var ws = provider.GetRequiredService<PersistentWsClient>();
            var wsHadConnectedOnce = 0;
            ws.Connected += () => Interlocked.Exchange(ref wsHadConnectedOnce, 1);
            ws.Disconnected += _ =>
                dispatcher.BeginInvoke(
                    (Action)(() =>
                    {
                        // Au démarrage, le WS peut tenter de se connecter puis échouer (réseau lent),
                        // ce qui déclenche un "son de déconnexion" perçu comme un 2e son de lancement.
                        // Ne jouer ce son que si une connexion a déjà été établie au moins une fois.
                        if (Interlocked.CompareExchange(ref wsHadConnectedOnce, 0, 0) == 0)
                        {
                            return;
                        }
                        // Ne pas jouer un "son de dÇ¸connexion" tant qu'on n'est pas authentifiÇ¸ :
                        // Ç¸vite la superposition avec le son d'ouverture au dÇ¸marrage/avant login.
                        if (session.CurrentUser == null)
                        {
                            return;
                        }
                        sounds.Play(Modules.Audio.Models.SoundId.ClientDisconnected);
                    }),
                    DispatcherPriority.Send);
        }
        catch
        {
            // ignore
        }

        Log.Information("AppHost créé avec succès. Version: {Version}", AppInfo.GetDisplayVersion());

        return new AppHost(
            config,
            errors,
            provider.GetRequiredService<PersistentWsClient>(),
            provider.GetRequiredService<INavigationService>(),
            provider.GetRequiredService<ICredentialStore>(),
            provider.GetRequiredService<WsAuthenticationService>(),
            provider.GetRequiredService<IDialogService>(),
            provider.GetRequiredService<ISessionService>(),
            provider.GetRequiredService<CrashReporter>(),
            provider.GetRequiredService<NetworkStateMonitor>(),
            provider.GetRequiredService<SettingsManager<OptionsState>>(),
            provider);
    }

    private static string? TryFindRepoRoot()
    {
        static string? FindFrom(string start)
        {
            try
            {
                var dir = new DirectoryInfo(start);
                while (dir != null)
                {
                    if (Directory.Exists(Path.Combine(dir.FullName, ".git")) ||
                        File.Exists(Path.Combine(dir.FullName, "start-lila.ps1")))
                    {
                        return dir.FullName;
                    }
                    dir = dir.Parent;
                }
            }
            catch
            {
                // ignore
            }

            return null;
        }

        return FindFrom(Directory.GetCurrentDirectory()) ?? FindFrom(AppContext.BaseDirectory);
    }

    private static bool ShouldTestConnectivity()
    {
        string? flag = Environment.GetEnvironmentVariable("WS_TEST");
        return !string.Equals(flag, "0", StringComparison.OrdinalIgnoreCase) &&
               !string.Equals(flag, "false", StringComparison.OrdinalIgnoreCase);
    }

    private static void StartConnectivityTestInBackground(ClientConfiguration config, ErrorBus errors)
    {
        _ = Task.Run(async () =>
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            try
            {
                await Modules.Network.Services.WsConnectionTester
                    .TestAsync(config.ApiGatewayWs, errors, cts.Token)
                    .ConfigureAwait(false);
            }
            catch
            {
                // Erreur déjà publiée dans ErrorBus ou timeout atteint.
            }
        });
    }

    private static Uri BuildPresenceEndpoint(ClientConfiguration config)
    {
        var builder = new UriBuilder(config.PresenceGatewayWs);
        builder.Query = "context=chat";
        return builder.Uri;
    }
}

public sealed class AppHost : IAsyncDisposable
{
    public AppHost(
        ClientConfiguration config,
        ErrorBus errors,
        PersistentWsClient wsClient,
        INavigationService navigation,
        ICredentialStore credentials,
        WsAuthenticationService authentication,
        IDialogService dialogs,
        ISessionService session,
        CrashReporter crashReporter,
        NetworkStateMonitor networkMonitor,
        SettingsManager<OptionsState> settingsManager,
        IServiceProvider provider)
    {
        Configuration = config;
        Errors = errors;
        WsClient = wsClient;
        Navigation = navigation;
        CredentialStore = credentials;
        AuthenticationService = authentication;
        Dialogs = dialogs;
        Session = session;
        CrashReporter = crashReporter;
        NetworkMonitor = networkMonitor;
        SettingsManager = settingsManager;
        Services = provider;
    }

    public ClientConfiguration Configuration { get; }
    public ErrorBus Errors { get; }
    public PersistentWsClient WsClient { get; }
    public INavigationService Navigation { get; }
    public ICredentialStore CredentialStore { get; }
    public WsAuthenticationService AuthenticationService { get; }
    public IDialogService Dialogs { get; }
    public ISessionService Session { get; }
    public CrashReporter CrashReporter { get; }
    public NetworkStateMonitor NetworkMonitor { get; }
    public SettingsManager<OptionsState> SettingsManager { get; }
    public IServiceProvider Services { get; }

    public HomeViewModel CreateHomeViewModel(Action<AuthenticatedUser> navigateToMenu, Action? requestExit) =>
        new(
            Configuration.ApplicationName,
            AuthenticationService,
            CredentialStore,
            Dialogs,
            navigateToMenu,
            requestExit,
            Errors);

    public MainMenuViewModel CreateMainMenuViewModel(AuthenticatedUser user, Action logout) =>
        new(user,
            Services.GetRequiredService<Modules.MainMenu.Services.IMenuRouter>(),
            Services.GetRequiredService<Modules.Catalog.Services.ICatalogService>(),
            Services.GetRequiredService<Modules.Network.Services.IApiCapabilitiesService>(),
            Services.GetRequiredService<Modules.MainMenu.Services.IMenuBadges>(),
            logout);

    public async ValueTask DisposeAsync()
    {
        Log.Information("Arrêt de l'application...");

        // Flush les settings avant de fermer
        if (SettingsManager != null)
        {
            await SettingsManager.FlushAsync().ConfigureAwait(false);
        }

        if (NetworkMonitor != null)
        {
            NetworkMonitor.Dispose();
        }

        if (WsClient != null)
        {
            await WsClient.DisposeAsync().ConfigureAwait(false);
        }

        if (Services is IAsyncDisposable asyncDisposable)
        {
            await asyncDisposable.DisposeAsync().ConfigureAwait(false);
        }
        else if (Services is IDisposable disposable)
        {
            disposable.Dispose();
        }

        LoggingConfiguration.CloseLogger();
    }
}
