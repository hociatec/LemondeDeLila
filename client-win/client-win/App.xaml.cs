using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;

namespace client_win
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private Mutex? _singleInstanceMutex;
        private bool _ownsSingleInstanceMutex;

        protected override void OnStartup(StartupEventArgs e)
        {
            // Empêche l'ouverture de plusieurs fenêtres/applications quand l'utilisateur relance le client
            // (raccourci, clickonce, restart update, etc.).
            const string mutexName = "LeMondeDeLila.Client.SingleInstance";
            try
            {
                _singleInstanceMutex = new Mutex(initiallyOwned: true, name: mutexName, createdNew: out var createdNew);
                _ownsSingleInstanceMutex = createdNew;
                if (!createdNew)
                {
                    // Une instance existe déjà : tenter de la ramener au premier plan et quitter.
                    try
                    {
                        SingleInstanceActivator.TryActivateExistingInstance();
                    }
                    catch
                    {
                        // ignore (best-effort)
                    }
                    Shutdown();
                    return;
                }
            }
            catch
            {
                // Best-effort: si le mutex échoue, on laisse l'app démarrer normalement.
            }

            base.OnStartup(e);
        }

        protected override void OnExit(ExitEventArgs e)
        {
            try
            {
                if (_ownsSingleInstanceMutex && _singleInstanceMutex != null)
                {
                    _singleInstanceMutex.ReleaseMutex();
                }
            }
            catch
            {
                // ignore
            }
            finally
            {
                try { _singleInstanceMutex?.Dispose(); } catch { /* ignore */ }
                _singleInstanceMutex = null;
            }

            base.OnExit(e);
        }
    }

    internal static class SingleInstanceActivator
    {
        public static void TryActivateExistingInstance()
        {
            var current = Process.GetCurrentProcess();
            var candidates = Process.GetProcessesByName(current.ProcessName)
                .Where(p => p != null && p.Id != current.Id)
                .ToList();

            foreach (var p in candidates)
            {
                try
                {
                    // Laisse le temps à l'autre instance d'avoir une fenêtre (best-effort).
                    for (var i = 0; i < 20; i++)
                    {
                        p.Refresh();
                        if (p.MainWindowHandle != IntPtr.Zero)
                        {
                            break;
                        }
                        Thread.Sleep(50);
                    }

                    var hwnd = p.MainWindowHandle;
                    if (hwnd == IntPtr.Zero)
                    {
                        continue;
                    }

                    NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE);
                    NativeMethods.SetForegroundWindow(hwnd);
                    NativeMethods.SwitchToThisWindow(hwnd, fAltTab: true);
                    return;
                }
                catch
                {
                    // ignore - continue other candidates
                }
            }
        }
    }

    internal static class NativeMethods
    {
        public const int SW_RESTORE = 9;

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        // Deprecated but still useful for bringing the window forward in some cases.
        [DllImport("user32.dll")]
        public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
    }

}
