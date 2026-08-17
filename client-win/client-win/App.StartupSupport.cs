using System;
using System.IO;

namespace client_win
{
    public partial class App
    {
        private static string EnsureAppDataPath()
        {
            var appDataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                Core.Constants.AppConstants.AppDataFolderName);
            Directory.CreateDirectory(appDataPath);
            return appDataPath;
        }

        private static void TryAppendStartupLog(string appDataPath, string message, Exception? ex = null)
        {
            try
            {
                var path = Path.Combine(appDataPath, "startup.log");
                var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} {message}";
                if (ex != null)
                {
                    line += $" | {ex.GetType().Name}: {ex.Message}";
                }

                File.AppendAllText(path, line + Environment.NewLine);
            }
            catch
            {
                // ignore
            }
        }
    }
}
