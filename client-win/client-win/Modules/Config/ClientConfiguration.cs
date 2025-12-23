using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;

namespace client_win.Modules.Config;

public sealed class ClientConfiguration
{
    private const string DefaultHttp = "http://127.0.0.1:3001/api/";
    private const string DefaultWsApi = "ws://127.0.0.1:3001/ws/api";
    private const string DefaultWs = "ws://127.0.0.1:3001/ws";
    private const string DefaultWsNotify = "ws://127.0.0.1:3001/ws/notify";
    private const string DefaultWsGame = "ws://127.0.0.1:3001/ws/game";

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
        var properties = LoadProperties(pathOverride);
        string appName = properties.TryGetValue("app.name", out var n) && !string.IsNullOrWhiteSpace(n)
            ? n
            : "Le Monde de Lila";

        Uri httpBase = ToHttpUri(Get(properties, "network.http.base", DefaultHttp));
        Uri apiGateway = ToWsUri(Get(properties, "network.ws.api", DefaultWsApi), "/ws/api");
        Uri realtimeGateway = ToWsUri(Get(properties, "network.ws.url", DefaultWs), "/ws");
        Uri notifyGateway = ToWsUri(Get(properties, "network.ws.notify", DefaultWsNotify), "/ws/notify");
        Uri gameGateway = ToWsUri(Get(properties, "network.ws.game", DefaultWsGame), "/ws/game");
        string? sharedSecret = Normalize(Environment.GetEnvironmentVariable("NETWORK_WS_SECRET") ??
                                         Environment.GetEnvironmentVariable("WS_SHARED_SECRET") ??
                                         (properties.TryGetValue("network.ws.secret", out var s) ? s : null));
        string? jwtSecret = Normalize(Environment.GetEnvironmentVariable("JWT_SECRET"));

        apiGateway = UpgradeToSecureWs(apiGateway, httpBase);
        realtimeGateway = UpgradeToSecureWs(realtimeGateway, httpBase);
        notifyGateway = UpgradeToSecureWs(notifyGateway, httpBase);
        gameGateway = UpgradeToSecureWs(gameGateway, httpBase);

        Validate(new[] { apiGateway, realtimeGateway, notifyGateway, gameGateway }, httpBase, sharedSecret);

        return new ClientConfiguration(appName, jwtSecret, httpBase, apiGateway, realtimeGateway, notifyGateway, gameGateway, sharedSecret);
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
        if (!string.IsNullOrWhiteSpace(overridePath) && File.Exists(overridePath!))
        {
            return overridePath;
        }

        string baseDir = AppContext.BaseDirectory;
        string[] candidates =
        {
            Path.Combine(baseDir, "config", "client.properties"),
            Path.Combine(baseDir, "..", "..", "..", "config", "client.properties"),
            Path.Combine(baseDir, "..", "..", "..", "..", "config", "client.properties"),
            Path.Combine(baseDir, "Modules", "Config", "client.properties"),
            Path.Combine(baseDir, "..", "..", "..", "Modules", "Config", "client.properties"),
            Path.Combine(baseDir, "..", "..", "..", "..", "..", "java-client", "config", "client.properties"),
            Path.Combine(baseDir, "..", "..", "..", "..", "..", "..", "java-client", "config", "client.properties"),
        };

        foreach (string candidate in candidates)
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

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
            throw new ConfigValidationException("Le secret partagé (NETWORK_WS_SECRET ou WS_SHARED_SECRET) est requis pour la sécurité de la connexion WebSocket. Veuillez le définir dans les variables d'environnement ou dans le fichier client.properties.");
        }
    }
}
