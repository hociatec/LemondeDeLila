using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using client_win.Core.Constants;
using Serilog;

namespace client_win.Modules.Config;

public sealed class ClientConfiguration
{
    private const string DefaultHttp = "http://127.0.0.1:3001/api/";
    private const string DefaultWsApi = "ws://127.0.0.1:3001/ws/api";
    private const string DefaultWs = "ws://127.0.0.1:3001/ws";
    private const string DefaultWsNotify = "ws://127.0.0.1:3001/ws/notify";
    private const string DefaultWsGame = "ws://127.0.0.1:3001/ws/game";
    private const string DefaultWsSharedSecret = "remote-ws-shared-secret-2025";

    public string ApplicationName { get; }
    public string? JwtSecret { get; }
    public Uri HttpBase { get; }
    public Uri ApiGatewayWs { get; }
    public Uri RealtimeGatewayWs { get; }
    public Uri NotifyGatewayWs { get; }
    public Uri GameGatewayWs { get; }
    public string? SharedSecret { get; }

    private ClientConfiguration(string applicationName,
        string? jwtSecret,
        Uri httpBase,
        Uri apiGatewayWs,
        Uri realtimeGatewayWs,
        Uri notifyGatewayWs,
        Uri gameGatewayWs,
        string? sharedSecret)
    {
        ApplicationName = applicationName;
        JwtSecret = jwtSecret;
        HttpBase = httpBase;
        ApiGatewayWs = apiGatewayWs;
        RealtimeGatewayWs = realtimeGatewayWs;
        NotifyGatewayWs = notifyGatewayWs;
        GameGatewayWs = gameGatewayWs;
        SharedSecret = sharedSecret;
    }

    public static ClientConfiguration Load(string? pathOverride = null)
    {
        Dictionary<string, string> properties;
        try
        {
            properties = LoadProperties(pathOverride);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur de lecture de la configuration. Utilisation des valeurs par défaut.");
            properties = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
        string appName = properties.TryGetValue("app.name", out var n) && !string.IsNullOrWhiteSpace(n)
            ? n
            : "Le Monde de Lila";

        Uri httpBase;
        Uri apiGateway;
        Uri realtimeGateway;
        Uri notifyGateway;
        Uri gameGateway;
        string? sharedSecret = Normalize(Environment.GetEnvironmentVariable("NETWORK_WS_SECRET") ??
                                         Environment.GetEnvironmentVariable("WS_SHARED_SECRET") ??
                                         (properties.TryGetValue("network.ws.secret", out var s) ? s : null));
        string? jwtSecret = Normalize(Environment.GetEnvironmentVariable("JWT_SECRET"));
        var environment = EnvironmentDetector.GetEnvironment();

        try
        {
            httpBase = ToHttpUri(Get(properties, "network.http.base", DefaultHttp));
            apiGateway = ToWsUri(Get(properties, "network.ws.api", DefaultWsApi), "/ws/api");
            realtimeGateway = ToWsUri(Get(properties, "network.ws.url", DefaultWs), "/ws");
            notifyGateway = ToWsUri(Get(properties, "network.ws.notify", DefaultWsNotify), "/ws/notify");
            gameGateway = ToWsUri(Get(properties, "network.ws.game", DefaultWsGame), "/ws/game");
        }
        catch (ConfigValidationException ex)
        {
            if (environment == EnvironmentDetector.AppEnvironment.Development)
            {
                Log.Warning(ex, "Configuration réseau invalide. Fallback sur la configuration par défaut (dev).");
                properties = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                httpBase = ToHttpUri(DefaultHttp);
                apiGateway = ToWsUri(DefaultWsApi, "/ws/api");
                realtimeGateway = ToWsUri(DefaultWs, "/ws");
                notifyGateway = ToWsUri(DefaultWsNotify, "/ws/notify");
                gameGateway = ToWsUri(DefaultWsGame, "/ws/game");
            }
            else
            {
                throw;
            }
        }

        if (string.IsNullOrWhiteSpace(sharedSecret) && environment == EnvironmentDetector.AppEnvironment.Development)
        {
            Log.Warning("Aucun secret WebSocket détecté - utilisation du secret par défaut ({Secret}).", DefaultWsSharedSecret);
            sharedSecret = DefaultWsSharedSecret;
        }

        apiGateway = UpgradeToSecureWs(apiGateway, httpBase);
        realtimeGateway = UpgradeToSecureWs(realtimeGateway, httpBase);
        notifyGateway = UpgradeToSecureWs(notifyGateway, httpBase);
        gameGateway = UpgradeToSecureWs(gameGateway, httpBase);

        Validate(new[] { apiGateway, realtimeGateway, notifyGateway, gameGateway }, httpBase, sharedSecret);

        var config = new ClientConfiguration(appName, jwtSecret, httpBase, apiGateway, realtimeGateway, notifyGateway, gameGateway, sharedSecret);

        // Log de la configuration finale (masquer les secrets)
        Log.Information("Configuration réseau chargée:");
        Log.Information("  - Application: {AppName}", appName);
        Log.Information("  - HTTP Base: {HttpBase}", httpBase);
        Log.Information("  - WebSocket API: {ApiGateway}", apiGateway);
        Log.Information("  - WebSocket Realtime: {RealtimeGateway}", realtimeGateway);
        Log.Information("  - WebSocket Notify: {NotifyGateway}", notifyGateway);
        Log.Information("  - WebSocket Game: {GameGateway}", gameGateway);
        Log.Information("  - Shared Secret: {HasSecret}", string.IsNullOrWhiteSpace(sharedSecret) ? "non défini" : "*****");
        Log.Information("  - JWT Secret: {HasJwtSecret}", string.IsNullOrWhiteSpace(jwtSecret) ? "non défini" : "*****");

        return config;
    }

    private static Dictionary<string, string> LoadProperties(string? pathOverride)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        string? path = ResolvePath(pathOverride);
        if (path == null || !File.Exists(path))
        {
            return map;
        }
        foreach (string line in File.ReadAllLines(path))
        {
            string trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#"))
            {
                continue;
            }
            int idx = trimmed.IndexOf('=');
            if (idx <= 0 || idx == trimmed.Length - 1)
            {
                continue;
            }
            string key = trimmed.Substring(0, idx).Trim();
            string value = trimmed.Substring(idx + 1).Trim();
            if (!string.IsNullOrWhiteSpace(key))
            {
                map[key] = value;
            }
        }
        return map;
    }

    private static string? ResolvePath(string? overridePath)
    {
        var environment = EnvironmentDetector.GetEnvironment();
        string baseDir = AppContext.BaseDirectory;
        string appConfigPath = Path.Combine(baseDir, "config", "client.properties");
        string appConfigExamplePath = Path.Combine(baseDir, "config", "client.properties.example");

        // 1. Override explicite (si fourni)
        if (!string.IsNullOrWhiteSpace(overridePath))
        {
            if (File.Exists(overridePath!))
            {
                Log.Information("Configuration chargée depuis le chemin fourni: {Path}", overridePath);
                return overridePath;
            }
            Log.Warning("Chemin de configuration fourni introuvable: {Path}", overridePath);
        }

        // En Staging/Production: on évite AppData (modifiable par l'utilisateur) et on lit uniquement
        // la configuration packagée dans le dossier de l'application (config/).
        if (environment != EnvironmentDetector.AppEnvironment.Development)
        {
            if (File.Exists(appConfigPath))
            {
                Log.Information("Configuration (prod) chargée depuis le dossier de l'application: {Path}", appConfigPath);
                return appConfigPath;
            }

            if (File.Exists(appConfigExamplePath))
            {
                Log.Warning("Configuration (prod) manquante, fallback sur client.properties.example: {Path}", appConfigExamplePath);
                return appConfigExamplePath;
            }

            return null;
        }

        // 2. Dossier utilisateur dans AppData (prioritaire pour ne pas écraser la config de l'utilisateur)
        string appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "config",
            "client.properties");
        if (File.Exists(appDataPath))
        {
            Log.Information("Configuration chargée depuis AppData: {Path}", appDataPath);
            return appDataPath;
        }

        // 3. Dossier de l'application (fallback / configuration packagée)
        // OPTIM: si aucun fichier AppData, on copie un template packagé vers AppData pour éviter les confusions
        // entre "config côté exécutable" et "config utilisateur".
        string? template = File.Exists(appConfigPath)
            ? appConfigPath
            : (File.Exists(appConfigExamplePath) ? appConfigExamplePath : null);
        if (template != null)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(appDataPath) ?? Path.Combine(baseDir, "config"));
                File.Copy(template, appDataPath, overwrite: false);
                Log.Information("Configuration initialisée dans AppData depuis {Template}: {Path}", template, appDataPath);
                return appDataPath;
            }
            catch (IOException)
            {
                // Déjà créé en parallèle ou verrouillé: on reteste l'existence.
                if (File.Exists(appDataPath))
                {
                    Log.Information("Configuration chargée depuis AppData: {Path}", appDataPath);
                    return appDataPath;
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Impossible d'initialiser la configuration AppData depuis {Template}", template);
            }
        }

        // Aucun fichier trouvé - créer configuration par défaut dans AppData
        Log.Warning("Aucun fichier de configuration trouvé. Utilisation des valeurs par défaut.");
        Log.Information("Vous pouvez créer un fichier de configuration dans: {Path}", appDataPath);

        return null;
    }

    private static string Get(Dictionary<string, string> map, string key, string fallback)
    {
        if (map.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return value.Trim();
        }
        string envKey = key.Replace('.', '_').ToUpperInvariant();
        string? fromEnv = Environment.GetEnvironmentVariable(envKey);
        return string.IsNullOrWhiteSpace(fromEnv) ? fallback : fromEnv.Trim();
    }

    private static string? Normalize(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return null;
        }
        var trimmed = candidate.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    private static Uri ToHttpUri(string candidate)
    {
        string value = candidate;
        if (!value.EndsWith("/", true, CultureInfo.InvariantCulture))
        {
            value += "/";
        }
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new ConfigValidationException($"URL HTTP invalide dans la configuration: {candidate}");
        }
        return uri;
    }

    private static Uri ToWsUri(string candidate, string suffix)
    {
        string value = (candidate ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            value = suffix.Contains("api", StringComparison.OrdinalIgnoreCase) ? DefaultWsApi : DefaultWs;
        }

        value = value.TrimEnd('/');
        string normalizedSuffix = "/" + suffix.Trim('/').ToLowerInvariant();
        string lowerValue = value.ToLowerInvariant();
        if (lowerValue.EndsWith(normalizedSuffix))
        {
            value = value[..^(normalizedSuffix.Length)];
        }
        value = $"{value}{normalizedSuffix}";

        if (!value.Contains("://", StringComparison.Ordinal))
        {
            value = suffix.Contains("api", StringComparison.OrdinalIgnoreCase)
                ? DefaultWsApi
                : DefaultWs;
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "ws" && uri.Scheme != "wss"))
        {
            throw new ConfigValidationException($"URL WebSocket invalide dans la configuration: {candidate}");
        }

        return uri;
    }

    private static Uri UpgradeToSecureWs(Uri wsUri, Uri httpBase)
    {
        if (httpBase.Scheme == Uri.UriSchemeHttps && wsUri.Scheme == "ws")
        {
            var builder = new UriBuilder(wsUri) { Scheme = "wss", Port = wsUri.Port == 80 ? -1 : wsUri.Port };
            return builder.Uri;
        }
        return wsUri;
    }

    private static void Validate(IEnumerable<Uri> wsUris, Uri httpBase, string? sharedSecret)
    {
        var environment = EnvironmentDetector.GetEnvironment();

        if (httpBase.Scheme != Uri.UriSchemeHttp && httpBase.Scheme != Uri.UriSchemeHttps)
        {
            throw new ConfigValidationException("Le schéma HTTP doit être http ou https.");
        }
        foreach (var uri in wsUris)
        {
            if (uri.Scheme != "ws" && uri.Scheme != "wss")
            {
                throw new ConfigValidationException($"Schéma WebSocket invalide: {uri}");
            }
            if (httpBase.Scheme == Uri.UriSchemeHttps && uri.Scheme != "wss")
            {
                throw new ConfigValidationException("Configuration incohérente : HTTPs demandé mais WebSocket non sécurisé.");
            }
        }

        if (string.IsNullOrWhiteSpace(sharedSecret))
        {
            if (environment == EnvironmentDetector.AppEnvironment.Development)
            {
                // En dev, on autorise le secret par défaut pour coller à la configuration backend
                Log.Warning("Aucun secret WebSocket défini. Utilisation du secret par défaut ({Secret}).", DefaultWsSharedSecret);
                sharedSecret = DefaultWsSharedSecret;
                return;
            }

            throw new ConfigValidationException("Le secret partagé (NETWORK_WS_SECRET ou WS_SHARED_SECRET) est requis pour la sécurité de la connexion WebSocket. Veuillez le définir dans les variables d'environnement ou dans le fichier client.properties.");
        }
    }
}
