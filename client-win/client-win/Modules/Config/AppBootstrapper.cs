using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Controls;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using client_win.Modules.Error;
using client_win.Modules.Network;
using client_win.Modules.Home.ViewModels;
using client_win.Modules.MainMenu.ViewModels;
using client_win.Modules.User.Services;
using client_win.Modules.User.Models;
using client_win.Modules.Shell.Services;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Chat.Services;
using client_win.Modules.Chat.Views;
using client_win.Core;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Social.Services;
using client_win.Modules.Game.Services;

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

        var config = ClientConfiguration.Load();
        var errors = new ErrorBus();

        if (testConnectivity && ShouldTestConnectivity())
        {
            TryTestConnectivity(config, errors);
        }

        var services = new ServiceCollection();
        services.AddLogging(builder =>
        {
            builder.SetMinimumLevel(LogLevel.Information);

            // Ajoute la sortie console pour le débogage et la production
            builder.AddConsole();

            // Ajoute la sortie debug pour Visual Studio
            builder.AddDebug();

            // Filtre les logs verbeux des bibliothèques Microsoft et System
            builder.AddFilter("Microsoft", LogLevel.Warning);
            builder.AddFilter("System", LogLevel.Warning);
        });
        services.AddSingleton(config);
        services.AddSingleton(errors);
        services.AddSingleton(rootHost);
        services.AddSingleton<INavigationService>(_ => new NavigationService(rootHost));
        services.AddSingleton<IDialogService, WpfDialogService>();
        services.AddSingleton<PersistentWsClient>(_ => new PersistentWsClient(config.ApiGatewayWs, errors));
        services.AddSingleton<WsRequestClient>(sp => new WsRequestClient(sp.GetRequiredService<PersistentWsClient>(), config.SharedSecret, errors));
        // Active le mode strict JWT si la variable d'environnement JWT_STRICT_MODE=true
        // Recommandé pour la production pour empêcher le bypass de validation
        bool jwtStrictMode = string.Equals(
            Environment.GetEnvironmentVariable("JWT_STRICT_MODE"),
            "true",
            StringComparison.OrdinalIgnoreCase);
        services.AddSingleton<JwtTokenValidator>(_ => new JwtTokenValidator(config.JwtSecret, jwtStrictMode));
        services.AddSingleton<WsAuthenticationService>(sp => new WsAuthenticationService(
            sp.GetRequiredService<WsRequestClient>(),
            sp.GetRequiredService<ILogger<WsAuthenticationService>>(),
            errors,
            sp.GetRequiredService<JwtTokenValidator>()));
        services.AddSingleton<ICredentialStore>(_ => new ErrorAwareCredentialStore(new ProtectedCredentialStore(), errors));
        services.AddSingleton<ISessionService, SessionService>();
        services.AddSingleton<IOptionsService, OptionsService>();
        services.AddSingleton<ICatalogService>(sp =>
            new CatalogService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
                errors));
        services.AddTransient<IWebSocketConnection, WebSocketConnection>();
        services.AddSingleton<IChatService>(sp =>
            new ChatService(BuildPresenceEndpoint(config), sp.GetRequiredService<IWebSocketConnection>(), sp.GetRequiredService<IOptionsService>(), sp.GetRequiredService<ISessionService>()));
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
        services.AddSingleton<IRoomDirectoryService>(sp =>
            new RoomDirectoryService(
                sp.GetRequiredService<WsRequestClient>(),
                sp.GetRequiredService<ISessionService>(),
                errors));
        services.AddSingleton<IRoomRealtimeService>(sp =>
            new RoomRealtimeService(
                sp.GetRequiredService<IWebSocketConnection>(),
                sp.GetRequiredService<ClientConfiguration>(),
                sp.GetRequiredService<ISessionService>(),
                errors));
        services.AddSingleton<IRoomSessionFactory, RoomSessionFactory>();
        services.AddSingleton<IRoomTableNavigator, RoomTableNavigator>();
        services.AddTransient<IMenuRouter, MenuRouter>();

        var provider = services.BuildServiceProvider();

        return new AppHost(
            config,
            errors,
            provider.GetRequiredService<PersistentWsClient>(),
            provider.GetRequiredService<INavigationService>(),
            provider.GetRequiredService<ICredentialStore>(),
            provider.GetRequiredService<WsAuthenticationService>(),
            provider.GetRequiredService<IDialogService>(),
            provider.GetRequiredService<ISessionService>(),
            provider);
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
        var builder = new UriBuilder(config.RealtimeGatewayWs);
        builder.Path = "/presence";
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
    public IServiceProvider Services { get; }

    public HomeViewModel CreateHomeViewModel(Action<AuthenticatedUser> navigateToMenu, Action? requestExit) =>
        new(Configuration.ApplicationName, AuthenticationService, CredentialStore, navigateToMenu, requestExit, Errors);

    public MainMenuViewModel CreateMainMenuViewModel(AuthenticatedUser user, Action logout) =>
        new(user, Services.GetRequiredService<Modules.MainMenu.Services.IMenuRouter>(), logout);

    public async ValueTask DisposeAsync()
    {
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
    }
}
