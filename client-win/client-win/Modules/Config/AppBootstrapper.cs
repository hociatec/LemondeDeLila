using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Controls;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Serilog;
using client_win.Modules.Error;
using client_win.Modules.Network;
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
using client_win.Modules.Admin.Services;
using client_win.Modules.Network.Services;
using client_win.Modules.Leaderboard.Services;
using client_win.Modules.Game.Play.Services;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.Services;

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
        var logsPath = Environment.GetEnvironmentVariable("LOG_PATH");
        if (string.IsNullOrWhiteSpace(logsPath))
        {
            if (environment == EnvironmentDetector.AppEnvironment.Development)
            {
                var repoRoot = TryFindRepoRoot();
                if (!string.IsNullOrWhiteSpace(repoRoot))
                {
                    logsPath = Path.Combine(repoRoot, "client-win", "client", "log");
                }
            }
            // En dev (dotnet run / scripts), on logge dans le dossier de travail pour faciliter le debug.
            // En prod, on logge à côté de l'exécutable.
            if (string.IsNullOrWhiteSpace(logsPath))
            {
                logsPath = environment == EnvironmentDetector.AppEnvironment.Development
                    ? Path.Combine(Directory.GetCurrentDirectory(), "client", "log")
                    : Path.Combine(baseDir, "client", "log");
            }
        }
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName);
        Directory.CreateDirectory(appDataPath);

        LoggingConfiguration.ConfigureLogger(logsPath);

        // 2. Détecter environnement et valider exigences de production
        Log.Information("Environnement détecté: {Environment}", environment);

        ProductionValidator.ValidateProductionRequirements(environment);
        ProductionValidator.LogConfiguration();

        // 3. Charger configuration réseau et applicative
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
        // 5. Test de connectivité optionnel
        if (testConnectivity && ShouldTestConnectivity())
        {
            TryTestConnectivity(config, errors);
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
        services.AddSingleton<IDialogService, WpfDialogService>();
        services.AddSingleton<IScreenReaderAnnouncer>(screenReaderAnnouncer);
        services.AddTransient<IRoomAnnouncements, RoomAnnouncements>();
        services.AddTransient<IGameAnnouncements, GameAnnouncements>();

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
            config.SharedSecret,
            errors));

        // JWT avec strict mode
        bool jwtStrictMode = string.Equals(
            Environment.GetEnvironmentVariable("JWT_STRICT_MODE"),
            "true",
            StringComparison.OrdinalIgnoreCase);
        services.AddSingleton<JwtTokenValidator>(_ => new JwtTokenValidator(config.JwtSecret, jwtStrictMode));

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

        // OptionsService (dans le shell) avec SettingsManager + Navigation
        services.AddSingleton<IOptionsService>(sp => new OptionsService(
            sp.GetRequiredService<SettingsManager<OptionsState>>(),
            sp.GetRequiredService<INavigationService>()));

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
                () => sp.GetRequiredService<IWebSocketConnection>()));

        services.AddSingleton<IGameGatewayClient>(sp =>
            new GameGatewayClient(
                sp.GetRequiredService<ClientConfiguration>(),
                sp.GetRequiredService<ISessionService>(),
                () => sp.GetRequiredService<IWebSocketConnection>()));

        services.AddTransient<IGameTableOpener, GameTableOpener>();

        services.AddSingleton<IChatService>(sp =>
            new ChatService(
                BuildPresenceEndpoint(config),
                sp.GetRequiredService<IWebSocketConnection>(),
                sp.GetRequiredService<IOptionsService>(),
                sp.GetRequiredService<ISessionService>()));

        services.AddSingleton<IViewFactory<ChatWindow>, ChatWindowFactory>();
        services.AddSingleton<IChatLauncher, ChatLauncher>();

        services.AddSingleton<IMessagingService>(sp =>
            new MessagingService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
                errors));

        services.AddSingleton<ISocialService>(sp =>
            new SocialService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
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

        services.AddSingleton<INotifyListener>(sp =>
            new NotifyListener(
                sp.GetRequiredService<ClientConfiguration>(),
                sp.GetRequiredService<ISessionService>(),
                () => sp.GetRequiredService<IWebSocketConnection>(),
                sp.GetRequiredService<IScreenReaderAnnouncer>(),
                sp.GetRequiredService<Modules.Catalog.Services.ICatalogService>()));

        services.AddTransient<IMenuRouter, MenuRouter>();

        var provider = services.BuildServiceProvider();

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

    private static void TryTestConnectivity(ClientConfiguration config, ErrorBus errors)
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        try
        {
            Modules.Network.Services.WsConnectionTester
                .TestAsync(config.ApiGatewayWs, config.SharedSecret, errors, cts.Token)
                .GetAwaiter().GetResult();
        }
        catch
        {
            // Erreur déjà publiée dans ErrorBus ou timeout atteint.
        }
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
        new(Configuration.ApplicationName, AuthenticationService, CredentialStore, navigateToMenu, requestExit, Errors);

    public MainMenuViewModel CreateMainMenuViewModel(AuthenticatedUser user, Action logout) =>
        new(user,
            Services.GetRequiredService<Modules.MainMenu.Services.IMenuRouter>(),
            Services.GetRequiredService<Modules.Catalog.Services.ICatalogService>(),
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
