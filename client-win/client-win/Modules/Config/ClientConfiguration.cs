using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using client_win.Core.Constants;
using Serilog;

namespace client_win.Modules.Config;

public sealed class ClientConfiguration
{
    // Defaults: environnement serveur (client distant).
    // Pour un usage local, surcharger via AppData\\...\\config\\client.properties ou variables d'env NETWORK_*.
    private const string DefaultHttp = "https://api.lilas.hociatec.fr/api/";
    private const string DefaultWsApi = "wss://ws.lilas.hociatec.fr/ws/api";
    private const string DefaultWs = "wss://ws.lilas.hociatec.fr/ws";
    private const string DefaultWsPresence = "wss://ws.lilas.hociatec.fr/presence";
    private const string DefaultWsNotify = "wss://ws.lilas.hociatec.fr/ws/notify";
    private const string DefaultWsGame = "wss://ws.lilas.hociatec.fr/ws/game";

    public string ApplicationName { get; }
    public Uri HttpBase { get; }
    public Uri ApiGatewayWs { get; }
    public Uri RealtimeGatewayWs { get; }
    public Uri PresenceGatewayWs { get; }
    public Uri NotifyGatewayWs { get; }
    public Uri GameGatewayWs { get; }
    public Uri UpdatesCheckUrl { get; }
    public string JwtIssuer { get; }
    public string? JwtAudience { get; }
    public string? JwtSignaturePublicKeyPath { get; }
    public string? AdminMaintenanceToken { get; }

    private ClientConfiguration(
        string applicationName,
        Uri httpBase,
        Uri apiGatewayWs,
        Uri realtimeGatewayWs,
        Uri presenceGatewayWs,
        Uri notifyGatewayWs,
        Uri gameGatewayWs,
        Uri updatesCheckUrl,
        string jwtIssuer,
        string? jwtAudience,
        string? jwtSignaturePublicKeyPath,
        string? adminMaintenanceToken)
    {
        ApplicationName = applicationName;
        HttpBase = httpBase;
        ApiGatewayWs = apiGatewayWs;
        RealtimeGatewayWs = realtimeGatewayWs;
        PresenceGatewayWs = presenceGatewayWs;
        NotifyGatewayWs = notifyGatewayWs;
        GameGatewayWs = gameGatewayWs;
        UpdatesCheckUrl = updatesCheckUrl;
        JwtIssuer = jwtIssuer;
        JwtAudience = jwtAudience;
        JwtSignaturePublicKeyPath = jwtSignaturePublicKeyPath;
        AdminMaintenanceToken = adminMaintenanceToken;
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
        Uri presenceGateway;
        Uri notifyGateway;
        Uri gameGateway;
        var environment = EnvironmentDetector.GetEnvironment();

        try
        {
            httpBase = ToHttpUri(Get(properties, "network.http.base", DefaultHttp));
            apiGateway = ToWsUri(Get(properties, "network.ws.api", DefaultWsApi), "/ws/api");
            realtimeGateway = ToWsUri(Get(properties, "network.ws.url", DefaultWs), "/ws");
            presenceGateway = ToWsUri(Get(properties, "network.ws.presence", DefaultWsPresence), "/presence");
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
                presenceGateway = ToWsUri(DefaultWsPresence, "/presence");
                notifyGateway = ToWsUri(DefaultWsNotify, "/ws/notify");
                gameGateway = ToWsUri(DefaultWsGame, "/ws/game");
            }
            else
            {
                throw;
            }
        }

        apiGateway = UpgradeToSecureWs(apiGateway, httpBase);
        realtimeGateway = UpgradeToSecureWs(realtimeGateway, httpBase);
        presenceGateway = UpgradeToSecureWs(presenceGateway, httpBase);
        notifyGateway = UpgradeToSecureWs(notifyGateway, httpBase);
        gameGateway = UpgradeToSecureWs(gameGateway, httpBase);

        Validate(new[] { apiGateway, realtimeGateway, presenceGateway, notifyGateway, gameGateway }, httpBase);
        var defaultUpdateCheck = new Uri(httpBase, "../client/version").ToString();
        var updatesCheckUrl = ToHttpUri(Get(properties, "updates.check.url", defaultUpdateCheck));

        string jwtIssuer = Get(properties, "jwt.issuer", "le-monde-de-lila");
        string? jwtAudience = Normalize(Get(properties, "jwt.audience", string.Empty));
        string? jwtPublicKeyPath = ResolveOptionalPath(Get(properties, "jwt.signature.publicKey", string.Empty));
        string? adminMaintenanceToken =
            (properties.TryGetValue("admin.maintenance.token", out var maintenanceToken)
                ? Normalize(maintenanceToken)
                : null)
            ?? Normalize(Environment.GetEnvironmentVariable("CLIENT_ADMIN_MAINTENANCE_TOKEN"))
            ?? Normalize(Environment.GetEnvironmentVariable("ADMIN_MAINTENANCE_TOKEN"));

        var config = new ClientConfiguration(
            appName,
            httpBase,
            apiGateway,
            realtimeGateway,
            presenceGateway,
            notifyGateway,
            gameGateway,
            updatesCheckUrl,
            jwtIssuer,
            jwtAudience,
            jwtPublicKeyPath,
            adminMaintenanceToken);

        // Log de la configuration finale (masquer les secrets)
        Log.Information("Configuration réseau chargée:");
        Log.Information("  - Application: {AppName}", appName);
        Log.Information("  - HTTP Base: {HttpBase}", httpBase);
        Log.Information("  - WebSocket API: {ApiGateway}", apiGateway);
        Log.Information("  - WebSocket Realtime: {RealtimeGateway}", realtimeGateway);
        Log.Information("  - WebSocket Presence: {PresenceGateway}", presenceGateway);
        Log.Information("  - WebSocket Notify: {NotifyGateway}", notifyGateway);
        Log.Information("  - WebSocket Game: {GameGateway}", gameGateway);
        Log.Information("  - Updates check URL: {UpdatesCheckUrl}", updatesCheckUrl);
        if (!string.IsNullOrWhiteSpace(jwtPublicKeyPath))
        {
            Log.Information("  - JWT signature public key: {JwtPublicKey}", jwtPublicKeyPath);
        }

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
        string? packagedTemplatePath = File.Exists(appConfigPath)
            ? appConfigPath
            : (File.Exists(appConfigExamplePath) ? appConfigExamplePath : null);

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
            // Migration "sans action utilisateur" (dev uniquement) :
            // - si AppData contient encore l'ancien template (localhost)
            // - et que le template packagé a changé (ex: endpoints prod),
            // alors on met à jour AppData uniquement si l'utilisateur n'a pas modifié le fichier.
            TryMigrateDevAppDataConfig(appDataPath, packagedTemplatePath);
            Log.Information("Configuration chargée depuis AppData: {Path}", appDataPath);
            return appDataPath;
        }

        // 3. Dossier de l'application (fallback / configuration packagée)
        // OPTIM: si aucun fichier AppData, on copie un template packagé vers AppData pour éviter les confusions
        // entre "config côté exécutable" et "config utilisateur".
        if (packagedTemplatePath != null)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(appDataPath) ?? Path.Combine(baseDir, "config"));
                File.Copy(packagedTemplatePath, appDataPath, overwrite: false);
                WriteSeedHashIfMissing(appDataPath, packagedTemplatePath);
                Log.Information("Configuration initialisée dans AppData depuis {Template}: {Path}", packagedTemplatePath, appDataPath);
                return appDataPath;
            }
            catch (IOException)
            {
                // Déjà créé en parallèle ou verrouillé: on reteste l'existence.
                if (File.Exists(appDataPath))
                {
                    WriteSeedHashIfMissing(appDataPath, packagedTemplatePath);
                    Log.Information("Configuration chargée depuis AppData: {Path}", appDataPath);
                    return appDataPath;
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Impossible d'initialiser la configuration AppData depuis {Template}", packagedTemplatePath);
            }
        }

        // Aucun fichier trouvé - créer configuration par défaut dans AppData
        Log.Warning("Aucun fichier de configuration trouvé. Utilisation des valeurs par défaut.");
        Log.Information("Vous pouvez créer un fichier de configuration dans: {Path}", appDataPath);

        return null;
    }

    private static string Get(Dictionary<string, string> map, string key, string fallback)
    {
        string envKey = key.Replace('.', '_').ToUpperInvariant();
        string? fromEnv = Environment.GetEnvironmentVariable(envKey);
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            return fromEnv.Trim();
        }

        if (map.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return value.Trim();
        }

        return fallback;
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

    private static string? ResolveOptionalPath(string? candidate)
    {
        var value = Normalize(candidate);
        if (value == null)
        {
            return null;
        }

        // Allow relative paths in client.properties (resolved against the app base dir).
        if (!Path.IsPathRooted(value))
        {
            value = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, value));
        }

        return value;
    }

    private static void TryMigrateDevAppDataConfig(string appDataPath, string? packagedTemplatePath)
    {
        if (packagedTemplatePath == null) return;

        // On ne migre qu'en dev : en prod, AppData n'est pas utilisé.
        var environment = EnvironmentDetector.GetEnvironment();
        if (environment != EnvironmentDetector.AppEnvironment.Development) return;

        try
        {
            string current = File.ReadAllText(appDataPath);
            if (!LooksLikeLegacyLocalhost(current))
            {
                // Pas un template local "hérité" -> on ne touche pas.
                return;
            }

            string packaged = File.ReadAllText(packagedTemplatePath);
            // Si le template packagé est lui-même localhost, rien à migrer.
            if (LooksLikeLegacyLocalhost(packaged))
            {
                return;
            }

            // Si l'utilisateur a déjà modifié AppData, on ne migre pas.
            // On considère "non modifié" si le contenu actuel correspond au seed d'origine.
            string seedPath = SeedPath(appDataPath);
            if (File.Exists(seedPath))
            {
                var seedHash = (File.ReadAllText(seedPath) ?? string.Empty).Trim();
                var currentHash = HashText(current);
                if (!string.IsNullOrWhiteSpace(seedHash) &&
                    string.Equals(seedHash, currentHash, StringComparison.OrdinalIgnoreCase))
                {
                    File.WriteAllText(appDataPath, packaged);
                    File.WriteAllText(seedPath, HashText(packaged));
                    Log.Information("Configuration AppData migrée automatiquement vers le template packagé (dev).");
                }
                return;
            }

            // Anciennes versions : pas de seed. Migration seulement si AppData semble être le template par défaut.
            // Heuristique : présence explicite de tous les endpoints localhost.
            if (LooksLikeFullLegacyLocalTemplate(current))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(appDataPath) ?? ".");
                File.WriteAllText(appDataPath, packaged);
                File.WriteAllText(seedPath, HashText(packaged));
                Log.Information("Configuration AppData migrée automatiquement (seed créé).");
            }
        }
        catch
        {
            // Best effort: ne jamais empêcher le démarrage
        }
    }

    private static bool LooksLikeLegacyLocalhost(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return false;
        return content.Contains("127.0.0.1:3001", StringComparison.OrdinalIgnoreCase) ||
               content.Contains("localhost:3001", StringComparison.OrdinalIgnoreCase);
    }

    private static bool LooksLikeFullLegacyLocalTemplate(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return false;
        return content.Contains("network.http.base=http://127.0.0.1:3001/api/", StringComparison.OrdinalIgnoreCase) &&
               content.Contains("network.ws.url=ws://127.0.0.1:3001/ws", StringComparison.OrdinalIgnoreCase) &&
               content.Contains("network.ws.api=ws://127.0.0.1:3001/ws/api", StringComparison.OrdinalIgnoreCase) &&
               content.Contains("network.ws.game=ws://127.0.0.1:3001/ws/game", StringComparison.OrdinalIgnoreCase) &&
               content.Contains("network.ws.notify=ws://127.0.0.1:3001/ws/notify", StringComparison.OrdinalIgnoreCase);
    }

    private static void WriteSeedHashIfMissing(string appDataPath, string templatePath)
    {
        try
        {
            string seedPath = SeedPath(appDataPath);
            if (File.Exists(seedPath)) return;
            if (!File.Exists(templatePath)) return;
            var template = File.ReadAllText(templatePath);
            File.WriteAllText(seedPath, HashText(template));
        }
        catch
        {
            // ignore
        }
    }

    private static string SeedPath(string appDataPath) => $"{appDataPath}.seed";

    private static string HashText(string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text ?? string.Empty);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
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

    private static void Validate(IEnumerable<Uri> wsUris, Uri httpBase)
    {
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
    }
}
