using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Threading;
using client_win.Core.Constants;
using Serilog;

namespace client_win.Modules.Updates;

public static class UpdateRestartHelper
{
    /// <summary>
    /// Tente de relancer le client. Retourne true si le restart a été déclenché (et l'app va se fermer),
    /// false si le relancement a échoué (l'app reste ouverte).
    /// </summary>
    public static bool RestartCurrentProcess(string reason = "unknown")
    {
        var app = Application.Current;
        var dispatcher = app?.Dispatcher;
        if (dispatcher != null && !dispatcher.CheckAccess())
        {
            // Appelé depuis un autre thread: on programme et on retourne "false" (état inconnu côté appelant).
            dispatcher.BeginInvoke(DispatcherPriority.Normal, new Action(() => RestartCurrentProcess(reason)));
            return false;
        }

        var exePath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(exePath))
        {
            WriteUpdateTrace($"Restart demandé ({reason}) mais ProcessPath est vide -> shutdown.");
            return false;
        }

        var started = false;
        try
        {
            WriteUpdateTrace($"Restart demandé ({reason}). exe={exePath}");
            Process.Start(new ProcessStartInfo(exePath) { UseShellExecute = true });
            started = true;
        }
        catch (Exception ex)
        {
            // Best-effort: even if restart fails, the update will apply on next manual launch.
            WriteUpdateTrace($"Restart échoué ({reason}): {ex.GetType().Name}: {ex.Message}");
            Log.Warning(ex, "Restart échoué ({Reason})", reason);
            return false;
        }

        if (!started)
        {
            return false;
        }

        try
        {
            Log.Information("Fermeture application pour mise à jour ({Reason})", reason);
            Log.CloseAndFlush();
            app?.Shutdown();
        }
        catch
        {
            // Ignore shutdown errors (dispatcher tearing down / wrong thread), the app is already closing.
        }

        return true;
    }

    private static void WriteUpdateTrace(string line)
    {
        try
        {
            var appData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppConstants.AppDataFolderName);
            var logDir = Path.Combine(appData, "log");
            Directory.CreateDirectory(logDir);
            var file = Path.Combine(logDir, "update-events.log");
            File.AppendAllText(file, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {line}{Environment.NewLine}");
        }
        catch
        {
            // ignore
        }
    }
}
