using System.IO;
using System.Reflection;
using System.Text.Json;
using client_win.Modules.Error;
using Serilog;

namespace client_win.Core.Diagnostics;

/// <summary>
/// Service de génération et sauvegarde de rapports de crash.
/// </summary>
public sealed class CrashReporter
{
    private readonly string _crashesDirectory;
    private const int MaxCrashFiles = 50;

    public CrashReporter(string appDataPath)
    {
        _crashesDirectory = Path.Combine(appDataPath, "crashes");
        Directory.CreateDirectory(_crashesDirectory);
    }

    /// <summary>
    /// Génère et sauvegarde un rapport de crash.
    /// </summary>
    /// <param name="exception">L'exception capturée.</param>
    /// <param name="appError">L'erreur applicative associée (optionnel).</param>
    /// <param name="sessionInfo">Informations de session (optionnel).</param>
    public void ReportCrash(Exception exception, AppError? appError = null, SessionInfo? sessionInfo = null)
    {
        try
        {
            var report = new CrashReport
            {
                Timestamp = DateTime.UtcNow,
                AppVersion = GetAppVersion(),
                ExceptionType = exception.GetType().FullName ?? "Unknown",
                Message = exception.Message,
                StackTrace = exception.ToString(), // Inclut stack trace complète + inner exceptions
                Context = appError?.Context,
                Environment = new EnvironmentInfo(),
                Session = sessionInfo
            };

            SaveCrashReport(report);
            CleanupOldCrashReports();

            Log.Fatal(exception, "Crash report généré: {Context}", appError?.Context ?? "unknown");
        }
        catch (Exception ex)
        {
            // Fail-safe: ne jamais lancer d'exception depuis le crash reporter
            Log.Error(ex, "Échec de génération du crash report");
        }
    }

    private void SaveCrashReport(CrashReport report)
    {
        var fileName = $"crash-{report.Timestamp:yyyyMMdd-HHmmss}.json";
        var filePath = Path.Combine(_crashesDirectory, fileName);

        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        };

        var json = JsonSerializer.Serialize(report, options);
        File.WriteAllText(filePath, json);

        Log.Information("Crash report sauvegardé: {FilePath}", filePath);
    }

    private void CleanupOldCrashReports()
    {
        try
        {
            var crashFiles = Directory.GetFiles(_crashesDirectory, "crash-*.json")
                .OrderByDescending(f => File.GetCreationTimeUtc(f))
                .ToArray();

            if (crashFiles.Length > MaxCrashFiles)
            {
                var filesToDelete = crashFiles.Skip(MaxCrashFiles);
                foreach (var file in filesToDelete)
                {
                    File.Delete(file);
                    Log.Debug("Ancien crash report supprimé: {FilePath}", file);
                }
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Échec du nettoyage des anciens crash reports");
        }
    }

    private static string GetAppVersion()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var version = assembly.GetName().Version;
        return version?.ToString() ?? "0.0.0.0";
    }

    /// <summary>
    /// Récupère le chemin du dossier de crashes.
    /// </summary>
    public string GetCrashesDirectory() => _crashesDirectory;
}
