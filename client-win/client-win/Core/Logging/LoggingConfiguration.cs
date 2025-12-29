using System.IO;
using System;
using System.Collections.Generic;
using System.Linq;
using Serilog;
using Serilog.Events;

namespace client_win.Core.Logging;

/// <summary>
/// Configuration centralisée pour le logging avec Serilog.
/// </summary>
public static class LoggingConfiguration
{
    private static LogEventLevel ResolveMinimumLevel(LogEventLevel fallback)
    {
        var raw = Environment.GetEnvironmentVariable("LOG_LEVEL");
        if (string.IsNullOrWhiteSpace(raw))
        {
            return fallback;
        }

        // Accepte: Verbose, Debug, Information, Warning, Error, Fatal
        if (Enum.TryParse<LogEventLevel>(raw, ignoreCase: true, out var parsed))
        {
            return parsed;
        }

        // Compatibilité avec des valeurs courantes ("info", "warn"...)
        return raw.Trim().ToLowerInvariant() switch
        {
            "trace" => LogEventLevel.Verbose,
            "verbose" => LogEventLevel.Verbose,
            "debug" => LogEventLevel.Debug,
            "info" => LogEventLevel.Information,
            "information" => LogEventLevel.Information,
            "warn" => LogEventLevel.Warning,
            "warning" => LogEventLevel.Warning,
            "error" => LogEventLevel.Error,
            "fatal" => LogEventLevel.Fatal,
            _ => fallback
        };
    }

    /// <summary>
    /// Configure et initialise le logger global Serilog.
    /// </summary>
    /// <param name="logsPath">Chemin du dossier de logs (ex: client/log).</param>
    /// <param name="mirrorLogsPath">Chemin additionnel (optionnel) où recopier les logs.</param>
    /// <param name="minLevel">Niveau minimum de log (défaut: Information).</param>
    public static void ConfigureLogger(string logsPath, string? mirrorLogsPath = null, LogEventLevel minLevel = LogEventLevel.Information)
    {
        minLevel = ResolveMinimumLevel(minLevel);

        var targets = new[] { logsPath, mirrorLogsPath }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        foreach (var target in targets)
        {
            Directory.CreateDirectory(target);
        }

        var cfg = new LoggerConfiguration()
            .MinimumLevel.Is(minLevel)
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .WriteTo.Console(
                outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
            .WriteTo.Debug();

        foreach (var target in targets)
        {
            cfg = cfg.WriteTo.File(
                path: Path.Combine(target, "lemondedelila-.log"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 14,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {Message:lj}{NewLine}{Exception}",
                shared: true);
        }

        Log.Logger = cfg.CreateLogger();

        Log.Information("=== Le Monde de Lila - Démarrage de l'application ===");
        Log.Information("Chemins des logs: {LogsPaths}", string.Join(" | ", targets));
        Log.Information("Niveau de logs: {LogLevel}", minLevel);
    }

    /// <summary>
    /// Ferme et libère les ressources du logger.
    /// </summary>
    public static void CloseLogger()
    {
        Log.Information("=== Arrêt de l'application ===");
        Log.CloseAndFlush();
    }
}
