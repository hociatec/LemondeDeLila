using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Data;
using System.Windows.Automation;
using System.Windows.Interop;
using client_win.Core.Accessibility;
using client_win.Modules.Audio.Services;
using client_win.Modules.Config;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Network.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace client_win
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private Mutex? _singleInstanceMutex;
        private bool _ownsSingleInstanceMutex;
        private FileStream? _singleInstanceLockFile;

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

            // Fallback/renfort : lockfile dans AppData (plus robuste avec ClickOnce/relances rapides).
            // Si un autre process détient le lock, on active l'instance existante et on quitte.
            try
            {
                var appDataPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    Core.Constants.AppConstants.AppDataFolderName);
                Directory.CreateDirectory(appDataPath);
                var lockPath = Path.Combine(appDataPath, "single-instance.lock");
                _singleInstanceLockFile = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            }
            catch
            {
                try { SingleInstanceActivator.TryActivateExistingInstance(); } catch { /* ignore */ }
                Shutdown();
                return;
            }

            base.OnStartup(e);

            var window = new MainWindow();
            var host = AppBootstrapper.Build();

            try
            {
                SpaceKeyAnnouncer.Initialize(host.Services.GetRequiredService<IScreenReaderAnnouncer>());
            }
            catch
            {
                // best-effort
            }

            var shell = new ShellViewModel(
                host,
                requestClose: window.Close,
                logger: host.Services.GetRequiredService<ILogger<ShellViewModel>>(),
                options: host.Services.GetRequiredService<IOptionsService>(),
                notify: host.Services.GetRequiredService<INotifyListener>(),
                presence: host.Services.GetRequiredService<IPresenceMonitor>(),
                presenceUi: host.Services.GetRequiredService<IPresenceLauncher>(),
                homeAccessor: host.Services.GetRequiredService<IHomeViewAccessor>(),
                menuRouter: host.Services.GetRequiredService<IMenuRouter>(),
                audio: host.Services.GetRequiredService<IAppAudioCoordinator>());

            window.DataContext = shell;

            // MVVM strict:
            // - Le DataContext de la fenêtre doit rester le ShellViewModel.
            // - Le Title ne doit jamais dépendre du DataContext courant (sinon WPF affiche ToString() -> type du VM).
            var applyingShellState = 0;
            void ApplyWindowShellState(string reason)
            {
                if (Interlocked.Exchange(ref applyingShellState, 1) == 1)
                {
                    return;
                }

                try
                {
                    var expectedTitle = shell.WindowTitle;

                    BindingOperations.ClearBinding(window, Window.TitleProperty);
                    if (!string.Equals(window.Title, expectedTitle, StringComparison.Ordinal))
                    {
                        window.Title = expectedTitle;
                    }

                    // NVDA/UIA: certains lecteurs d'écran s'appuient sur AutomationProperties.Name
                    // pour annoncer la fenêtre courante.
                    try { AutomationProperties.SetName(window, expectedTitle); } catch { /* ignore */ }
                    try
                    {
                        // Fallback: certains lecteurs d'écran lisent le nom du host focalisé plutôt que celui de la fenêtre.
                        if (window.FindName("RootHost") is DependencyObject rootHost)
                        {
                            AutomationProperties.SetName(rootHost, expectedTitle);
                        }
                    }
                    catch
                    {
                        // ignore
                    }
                }
                catch
                {
                    // ignore
                }

                try
                {
                    if (!ReferenceEquals(window.DataContext, shell))
                    {
                        window.DataContext = shell;
                    }
                }
                catch
                {
                    // ignore
                }
                finally
                {
                    Volatile.Write(ref applyingShellState, 0);
                }
            }
            ApplyWindowShellState("startup");

            PropertyChangedEventHandler? onShellPropertyChanged = null;
            onShellPropertyChanged = (_, args) =>
            {
                if (string.Equals(args.PropertyName, nameof(ShellViewModel.WindowTitle), StringComparison.Ordinal))
                {
                    ApplyWindowShellState("windowTitle.changed");
                }
            };
            shell.PropertyChanged += onShellPropertyChanged;

            DependencyPropertyChangedEventHandler? onWindowDataContextChanged = null;
            onWindowDataContextChanged = (_, _) => ApplyWindowShellState("window.datacontext.changed");
            window.DataContextChanged += onWindowDataContextChanged;

            // Dernière ligne de défense: si quelqu'un change le Title après coup, on le remet immédiatement.
            var titleDescriptor = DependencyPropertyDescriptor.FromProperty(Window.TitleProperty, typeof(Window));
            EventHandler? onWindowTitleChanged = null;
            onWindowTitleChanged = (_, _) =>
            {
                if (!string.Equals(window.Title, shell.WindowTitle, StringComparison.Ordinal))
                {
                    ApplyWindowShellState("window.title.changed");
                }
            };
            titleDescriptor.AddValueChanged(window, onWindowTitleChanged);

            window.Closed += (_, _) =>
            {
                try { shell.PropertyChanged -= onShellPropertyChanged; } catch { /* ignore */ }
                try { window.DataContextChanged -= onWindowDataContextChanged; } catch { /* ignore */ }
                try { titleDescriptor.RemoveValueChanged(window, onWindowTitleChanged); } catch { /* ignore */ }
            };

            MainWindow = window;
            window.Show();

            // Accessibility / screen readers (NVDA): on some startups the window can appear without getting OS focus,
            // forcing the user to alt-tab away/back before the UI is reachable. Best-effort: bring the window to front.
            window.Dispatcher.BeginInvoke(new Action(() =>
            {
                try
                {
                    if (!window.IsVisible)
                    {
                        return;
                    }

                    try { window.WindowState = WindowState.Normal; } catch { /* ignore */ }
                    try { window.Activate(); } catch { /* ignore */ }
                    try { window.Focus(); } catch { /* ignore */ }

                    try
                    {
                        var hwnd = new WindowInteropHelper(window).Handle;
                        if (hwnd != IntPtr.Zero)
                        {
                            NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE);
                            NativeMethods.SetForegroundWindow(hwnd);
                            NativeMethods.SwitchToThisWindow(hwnd, fAltTab: true);
                        }
                    }
                    catch
                    {
                        // best-effort
                    }
                }
                catch
                {
                    // best-effort
                }
            }), System.Windows.Threading.DispatcherPriority.ApplicationIdle);
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
                try { _singleInstanceLockFile?.Dispose(); } catch { /* ignore */ }
                _singleInstanceLockFile = null;
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
