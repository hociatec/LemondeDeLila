using System;
using System.IO;

namespace client_win.Core.Diagnostics;

internal static class ShortcutDiagnostics
{
    private static int _initialized;
    private static bool _enabled;
    private static string? _logPath;

    public static bool Enabled
    {
        get
        {
            EnsureInitialized();
            return _enabled;
        }
    }

    public static void TryLog(string message)
    {
        try
        {
            if (!Enabled)
            {
                return;
            }

            var path = _logPath;
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            File.AppendAllText(path, $"[{DateTime.UtcNow:O}] {message}{Environment.NewLine}");
        }
        catch
        {
            // best-effort
        }
    }

    private static void EnsureInitialized()
    {
        if (System.Threading.Interlocked.Exchange(ref _initialized, 1) == 1)
        {
            return;
        }

        try
        {
            var env = Environment.GetEnvironmentVariable("LMDL_DIAG_SHORTCUTS");
            _enabled = string.Equals(env, "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(env, "true", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(env, "yes", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            _enabled = false;
        }

        if (!_enabled)
        {
            return;
        }

        try
        {
            var appDataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                Core.Constants.AppConstants.AppDataFolderName,
                "log");
            Directory.CreateDirectory(appDataPath);
            _logPath = Path.Combine(appDataPath, "shortcuts.log");
        }
        catch
        {
            _logPath = null;
        }
    }
}

