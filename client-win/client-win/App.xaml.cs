using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Data;
using System.Windows.Automation;
using System.Windows.Interop;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
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
            MainWindow = window;

            // IMPORTANT (NVDA / clavier) :
            // Si on laisse la fenêtre cachée pendant le bootstrap, Windows peut refuser de lui donner le focus
            // lorsqu'on l'affiche plus tard (le process n'a plus le "foreground right"). Résultat : NVDA annonce
            // parfois le champ mais le clavier reste sur l'application précédente, jusqu'à un alt-tab.
            // On montre donc la fenêtre immédiatement et on initialise le Shell ensuite.
            try { window.Show(); } catch { /* best-effort */ }
            try
            {
                window.Activate();
                window.Focus();
                Keyboard.Focus(window);
            }
            catch { /* best-effort */ }

            // ClickOnce / dfsvc.exe : au démarrage, Windows peut refuser de donner le "foreground" à l'app
            // (règles SetForegroundWindow). On tente un bring-to-front best-effort sur le thread UI.
            try
            {
                window.Dispatcher.BeginInvoke(DispatcherPriority.Send, new Action(() =>
                {
                    try
                    {
                        var hwnd = new WindowInteropHelper(window).Handle;
                        if (hwnd != IntPtr.Zero)
                        {
                            ForegroundWindowHelper.TryForceForeground(hwnd);
                        }
                    }
                    catch { /* best-effort */ }
                }));
            }
            catch { /* best-effort */ }

            _ = BuildAndShowShellAsync(window);
        }

        private static bool IsDescendant(DependencyObject node, DependencyObject ancestor)
        {
            for (DependencyObject? current = node; current != null; current = GetParent(current))
            {
                if (ReferenceEquals(current, ancestor))
                {
                    return true;
                }
            }
            return false;
        }

        private static DependencyObject? GetParent(DependencyObject current)
        {
            try
            {
                if (current is Visual || current is System.Windows.Media.Media3D.Visual3D)
                {
                    return VisualTreeHelper.GetParent(current);
                }
            }
            catch
            {
                // ignore
            }

            if (current is FrameworkElement fe)
            {
                return fe.Parent ?? fe.TemplatedParent;
            }

            return LogicalTreeHelper.GetParent(current);
        }

        private async Task BuildAndShowShellAsync(MainWindow window)
        {
            AppHost? host = null;
            try
            {
                host = await Task.Run(() => AppBootstrapper.Build()).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                try
                {
                    await window.Dispatcher.InvokeAsync(() =>
                    {
                        MessageBox.Show(
                            $"Erreur au demarrage : {ex.Message}",
                            "Le Monde de Lila",
                            MessageBoxButton.OK,
                            MessageBoxImage.Error);
                        window.Close();
                    });
                }
                catch
                {
                    // ignore
                }
                return;
            }

            try
            {
                try
                {
                    SpaceKeyAnnouncer.Initialize(host.Services.GetRequiredService<IScreenReaderAnnouncer>());
                }
                catch
                {
                    // best-effort
                }

                // IMPORTANT: eager-resolve audio services while we're still on a background thread.
                // AudioDispatcher waits for a dedicated STA thread to start; if resolved on the UI thread it can freeze the UI.
                PrewarmBackgroundOnlyServices(host);

                await await window.Dispatcher.InvokeAsync(async () =>
                {
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
                    AttachShellWindowGuards(window, shell);

                    // Afficher l'accueil avant de montrer la fenêtre (pas de vue "Chargement").
                    shell.ShowHomeForStartup();

                    if (window.Visibility != Visibility.Visible)
                    {
                        window.Visibility = Visibility.Visible;
                    }
                    if (!window.IsVisible)
                    {
                        window.Show();
                    }

                    // S'assurer que la fenêtre est réellement active pour que Tab/Shift+Tab fonctionne dès l'ouverture.
                    void EnsureActive()
                    {
                        try
                        {
                            if (window.IsActive)
                            {
                                return;
                            }

                            window.Activate();
                            window.Focus();
                            Keyboard.Focus(window);
                        }
                        catch
                        {
                            // best-effort
                        }
                    }

                    EnsureActive();
                    window.Dispatcher.BeginInvoke((Action)EnsureActive, DispatcherPriority.Input);
                    window.Dispatcher.BeginInvoke((Action)EnsureActive, DispatcherPriority.ApplicationIdle);

                    void EnsureForeground()
                    {
                        try
                        {
                            if (!window.IsVisible)
                            {
                                return;
                            }

                            var hwnd = new WindowInteropHelper(window).Handle;
                            if (hwnd == IntPtr.Zero)
                            {
                                return;
                            }

                            NativeMethods.ShowWindow(hwnd, NativeMethods.SW_SHOW);
                            ForegroundWindowHelper.TryForceForeground(hwnd);
                        }
                        catch
                        {
                            // best-effort
                        }
                    }

                    EnsureForeground();
                    window.Dispatcher.BeginInvoke((Action)EnsureForeground, DispatcherPriority.Input);
                    window.Dispatcher.BeginInvoke((Action)EnsureForeground, DispatcherPriority.ApplicationIdle);

                    // ShellWindowBehavior calls OnLoadedAsync on Window.Loaded. If the window was loaded already
                    // (bootstrap phase), we must trigger the startup ourselves.
                    if (window.IsLoaded)
                    {
                        await shell.OnLoadedAsync().ConfigureAwait(true);
                    }
                }).Task;
            }
            catch (Exception ex)
            {
                try
                {
                    await window.Dispatcher.InvokeAsync(() =>
                    {
                        MessageBox.Show(
                            $"Erreur au demarrage : {ex.Message}",
                            "Le Monde de Lila",
                            MessageBoxButton.OK,
                            MessageBoxImage.Error);
                        window.Close();
                    });
                }
                catch
                {
                    // ignore
                }

                try { await host.DisposeAsync().ConfigureAwait(false); } catch { /* ignore */ }
            }
        }

        private static void PrewarmBackgroundOnlyServices(AppHost host)
        {
            try
            {
                // Forces creation of AudioDispatcher/SoundService/AppAudioCoordinator off the UI thread.
                _ = host.Services.GetRequiredService<IAppAudioCoordinator>();
            }
            catch
            {
                // best-effort
            }
        }

        private static void AttachShellWindowGuards(Window window, ShellViewModel shell)
        {
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
        public const int SW_SHOW = 5;
        public const int SW_MAXIMIZE = 3;

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        // Deprecated but still useful for bringing the window forward in some cases.
        [DllImport("user32.dll")]
        public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

        [DllImport("user32.dll")]
        public static extern IntPtr SetActiveWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern IntPtr SetFocus(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("kernel32.dll")]
        public static extern uint GetCurrentThreadId();

        [DllImport("user32.dll")]
        public static extern bool BringWindowToTop(IntPtr hWnd);
    }

    internal static class ForegroundWindowHelper
    {
        public static void TryForceForeground(IntPtr hwnd)
        {
            // Best-effort: Windows may deny SetForegroundWindow depending on launch context (common with ClickOnce).
            // AttachThreadInput is a common workaround to synchronize focus/activation with the current foreground thread.
            try
            {
                var foreground = NativeMethods.GetForegroundWindow();
                var foregroundThread = foreground != IntPtr.Zero
                    ? NativeMethods.GetWindowThreadProcessId(foreground, out _)
                    : 0;
                var currentThread = NativeMethods.GetCurrentThreadId();

                var attached = false;
                if (foregroundThread != 0 && foregroundThread != currentThread)
                {
                    try { attached = NativeMethods.AttachThreadInput(foregroundThread, currentThread, true); } catch { attached = false; }
                }

                try
                {
                    try { NativeMethods.ShowWindow(hwnd, NativeMethods.SW_SHOW); } catch { /* ignore */ }
                    try { NativeMethods.BringWindowToTop(hwnd); } catch { /* ignore */ }
                    try { NativeMethods.SetForegroundWindow(hwnd); } catch { /* ignore */ }
                    try { NativeMethods.SetActiveWindow(hwnd); } catch { /* ignore */ }
                    try { NativeMethods.SetFocus(hwnd); } catch { /* ignore */ }
                    try { NativeMethods.SwitchToThisWindow(hwnd, fAltTab: true); } catch { /* ignore */ }
                }
                finally
                {
                    if (attached)
                    {
                        try { NativeMethods.AttachThreadInput(foregroundThread, currentThread, false); } catch { /* ignore */ }
                    }
                }
            }
            catch
            {
                // ignore
            }
        }
    }

}
