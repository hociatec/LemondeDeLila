using System;
using System.Diagnostics;
using System.Windows;

namespace client_win.Modules.Updates;

public static class UpdateRestartHelper
{
    public static void RestartCurrentProcess()
    {
        var exePath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(exePath))
        {
            Application.Current?.Shutdown();
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo(exePath) { UseShellExecute = true });
        }
        catch
        {
            // Best-effort: even if restart fails, the update will apply on next manual launch.
        }
        finally
        {
            Application.Current?.Shutdown();
        }
    }
}

