using System;
using System.Diagnostics;

namespace client_win.Modules.Updates;

public static class UpdateEnvironment
{
    public static bool IsRunningUnderDotnetHost()
    {
        try
        {
            var exe = Environment.ProcessPath ?? string.Empty;
            if (exe.EndsWith("dotnet.exe", StringComparison.OrdinalIgnoreCase) ||
                exe.EndsWith("dotnet", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var name = Process.GetCurrentProcess().ProcessName ?? string.Empty;
            return string.Equals(name, "dotnet", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    public static bool IsLikelyClickOnceInstall()
    {
        // Typical ClickOnce install location:
        // %LOCALAPPDATA%\Apps\2.0\...
        try
        {
            var baseDir = AppContext.BaseDirectory ?? string.Empty;
            return baseDir.IndexOf("\\Apps\\2.0\\", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   baseDir.IndexOf("/Apps/2.0/", StringComparison.OrdinalIgnoreCase) >= 0;
        }
        catch
        {
            return false;
        }
    }
}

