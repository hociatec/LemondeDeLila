using System;
using System.Diagnostics;
using System.Windows;
using System.Windows.Threading;

namespace client_win.Modules.Updates;

public static class UpdateRestartHelper
{
    public static void RestartCurrentProcess()
    {
        var app = Application.Current;
        var dispatcher = app?.Dispatcher;
        if (dispatcher != null && !dispatcher.CheckAccess())
        {
            dispatcher.Invoke(RestartCurrentProcess, DispatcherPriority.Normal);
            return;
        }

        var exePath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(exePath))
        {
            app?.Shutdown();
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
            app?.Shutdown();
        }
    }
}
