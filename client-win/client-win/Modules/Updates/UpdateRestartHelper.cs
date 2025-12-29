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
    public static void RestartCurrentProcess(string reason = "unknown")
    {
        var app = Application.Current;
        var dispatcher = app?.Dispatcher;
        if (dispatcher != null && !dispatcher.CheckAccess())
        {
            dispatcher.BeginInvoke(
                DispatcherPriority.Normal,
                new Action(() => RestartCurrentProcess(reason)));
            return;
        }

        var exePath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(exePath))
        {
            WriteUpdateTrace($"Restart demandé ({reason}) mais ProcessPath est vide -> shutdown.");
            app?.Shutdown();
            return;
        }

        try
        {
            WriteUpdateTrace($"Restart demandé ({reason}). exe={exePath}");
            Process.Start(new ProcessStartInfo(exePath) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            // Best-effort: even if restart fails, the update will apply on next manual launch.
            WriteUpdateTrace($"Restart échoué ({reason}): {ex.GetType().Name}: {ex.Message}");
            Log.Warning(ex, "Restart échoué ({Reason})", reason);
        }
        finally
        {
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
        }
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
