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

            // Contournement "serein" et valable quel que soit le mode de lancement :
            // on enregistre un raccourci global qui permet à l'utilisateur de ramener la fenêtre au premier plan
            // même si Windows refuse le foreground au lancement (cas fréquent ClickOnce / launchers / tâches).
            // Un raccourci global (RegisterHotKey) est considéré comme une interaction utilisateur, donc
            // SetForegroundWindow est beaucoup plus fiable ensuite.
            try
            {
                window.SourceInitialized += (_, _) =>
                {
                    try
                    {
                        var hwnd = new WindowInteropHelper(window).Handle;
                        if (hwnd == IntPtr.Zero)
                        {
                            return;
                        }

                        // Activation retry: handle is ready here; try a few quick times while the user-initiated
                        // foreground allowance window is still open (helps with ClickOnce/launchers).
                        try { StartupActivationHelper.Begin(window, hwnd); } catch { /* ignore */ }

                        // Ctrl+Alt+Shift+L
                        var hotkeyOk = NativeMethods.RegisterHotKey(hwnd, NativeMethods.HOTKEY_ID_ACTIVATE, NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT | NativeMethods.MOD_SHIFT, NativeMethods.VK_L);
                        _ = hotkeyOk; // best-effort; if it fails, Alt+Tab remains available.

                        if (HwndSource.FromHwnd(hwnd) is HwndSource source)
                        {
                            source.AddHook((IntPtr h, int msg, IntPtr wParam, IntPtr lParam, ref bool handled) =>
                            {
                                if (msg == NativeMethods.WM_HOTKEY && wParam.ToInt32() == NativeMethods.HOTKEY_ID_ACTIVATE)
                                {
                                    handled = true;
                                    try { ForegroundWindowHelper.TryForceForeground(h); } catch { /* ignore */ }
                                }
                                return IntPtr.Zero;
                            });
                        }
                    }
                    catch
                    {
                        // best-effort
                    }
                };

                window.Closed += (_, _) =>
                {
                    try
                    {
                        var hwnd = new WindowInteropHelper(window).Handle;
                        if (hwnd != IntPtr.Zero)
                        {
                            NativeMethods.UnregisterHotKey(hwnd, NativeMethods.HOTKEY_ID_ACTIVATE);
                        }
                    }
                    catch { /* best-effort */ }
                };
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

                    // Si la fenêtre n'obtient pas le focus OS (fréquent sur certains démarrages ClickOnce),
                    // éviter l'effet "NVDA annonce un champ mais je ne peux pas taper".
                    // Stratégie plus sereine : attirer l'attention (flash) + message NVDA, sans voler le focus.
                    try
                    {
                        var announcer = host.Services.GetRequiredService<IScreenReaderAnnouncer>();
                        var activationTimer = new DispatcherTimer(DispatcherPriority.ApplicationIdle, window.Dispatcher)
                        {
                            Interval = TimeSpan.FromSeconds(1),
                        };

                        activationTimer.Tick += (_, _) =>
                        {
                            try
                            {
                                activationTimer.Stop();

                                if (!window.IsVisible || window.IsActive)
                                {
                                    return;
                                }

                                var hwnd = new WindowInteropHelper(window).Handle;
                                if (hwnd != IntPtr.Zero)
                                {
                                    try { NativeMethods.FlashWindowUntilForeground(hwnd); } catch { /* ignore */ }
                                }

                                announcer.AnnounceAssertiveEvenIfInactive(
                                    "Le Monde de Lila n'est pas actif. Faites Alt+Tab pour revenir sur la fenêtre, ou appuyez sur Contrôle Alt Majuscule L pour activer la fenêtre.");
                            }
                            catch
                            {
                                // best-effort
                            }
                        };

                        activationTimer.Start();
                    }
                    catch
                    {
                        // best-effort
                    }

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

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        public static readonly IntPtr HWND_TOPMOST = new(-1);
        public static readonly IntPtr HWND_NOTOPMOST = new(-2);

        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOACTIVATE = 0x0010;
        public const uint SWP_SHOWWINDOW = 0x0040;

        public const int WM_HOTKEY = 0x0312;
        public const int HOTKEY_ID_ACTIVATE = 1;

        public const uint MOD_ALT = 0x0001;
        public const uint MOD_CONTROL = 0x0002;
        public const uint MOD_SHIFT = 0x0004;

        public const uint VK_L = 0x4C;

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        [StructLayout(LayoutKind.Sequential)]
        public struct FLASHWINFO
        {
            public uint cbSize;
            public IntPtr hwnd;
            public uint dwFlags;
            public uint uCount;
            public uint dwTimeout;
        }

        public const uint FLASHW_STOP = 0;
        public const uint FLASHW_CAPTION = 1;
        public const uint FLASHW_TRAY = 2;
        public const uint FLASHW_ALL = 3;
        public const uint FLASHW_TIMERNOFG = 12;

        [DllImport("user32.dll")]
        public static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

        public static void FlashWindowUntilForeground(IntPtr hwnd)
        {
            try
            {
                var info = new FLASHWINFO
                {
                    cbSize = (uint)Marshal.SizeOf<FLASHWINFO>(),
                    hwnd = hwnd,
                    // Flash taskbar button until foreground, but don't loop forever if focus comes quickly.
                    dwFlags = FLASHW_TRAY | FLASHW_TIMERNOFG,
                    uCount = 3,
                    dwTimeout = 0,
                };
                FlashWindowEx(ref info);
            }
            catch
            {
                // ignore
            }
        }
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
                    try { NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE); } catch { /* ignore */ }
                    try { NativeMethods.BringWindowToTop(hwnd); } catch { /* ignore */ }
                    try { NativeMethods.SetForegroundWindow(hwnd); } catch { /* ignore */ }
                    try { NativeMethods.SetActiveWindow(hwnd); } catch { /* ignore */ }
                    try { NativeMethods.SetFocus(hwnd); } catch { /* ignore */ }
                    try { NativeMethods.SwitchToThisWindow(hwnd, fAltTab: true); } catch { /* ignore */ }

                    // Fallback: quick topmost toggle often succeeds when foreground rules block us (best-effort).
                    try
                    {
                        if (NativeMethods.GetForegroundWindow() != hwnd)
                        {
                            // Extra fallback: emulate the user action that "unblocks" in practice (restore/maximize).
                            // This triggers a non-client state change similar to clicking "agrandir".
                            try { NativeMethods.ShowWindow(hwnd, NativeMethods.SW_MAXIMIZE); } catch { /* ignore */ }

                            NativeMethods.SetWindowPos(
                                hwnd,
                                NativeMethods.HWND_TOPMOST,
                                0,
                                0,
                                0,
                                0,
                                NativeMethods.SWP_NOMOVE | NativeMethods.SWP_NOSIZE | NativeMethods.SWP_SHOWWINDOW);
                            NativeMethods.SetWindowPos(
                                hwnd,
                                NativeMethods.HWND_NOTOPMOST,
                                0,
                                0,
                                0,
                                0,
                                NativeMethods.SWP_NOMOVE | NativeMethods.SWP_NOSIZE | NativeMethods.SWP_SHOWWINDOW);

                            try { NativeMethods.SetForegroundWindow(hwnd); } catch { /* ignore */ }
                            try { NativeMethods.SetActiveWindow(hwnd); } catch { /* ignore */ }
                            try { NativeMethods.SetFocus(hwnd); } catch { /* ignore */ }
                        }
                    }
                    catch
                    {
                        // ignore
                    }
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

    internal static class StartupActivationHelper
    {
        private const int MaxAttempts = 10;
        private static readonly TimeSpan AttemptInterval = TimeSpan.FromMilliseconds(120);

        public static void Begin(Window window, IntPtr hwnd)
        {
            if (window == null) throw new ArgumentNullException(nameof(window));
            if (hwnd == IntPtr.Zero) return;

            var attempts = 0;
            var timer = new DispatcherTimer(DispatcherPriority.Send, window.Dispatcher)
            {
                Interval = AttemptInterval,
            };

            timer.Tick += (_, _) =>
            {
                try
                {
                    attempts++;

                    if (!window.IsVisible)
                    {
                        return;
                    }

                    // If the user already activated it, stop. Also stop after a short burst to avoid stealing focus later.
                    if (window.IsActive || attempts >= MaxAttempts)
                    {
                        timer.Stop();
                        return;
                    }

                    // Some shortcuts / launch contexts can start minimized; restoring triggers activation paths.
                    try { if (window.WindowState == WindowState.Minimized) window.WindowState = WindowState.Normal; } catch { /* ignore */ }
                    try { NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE); } catch { /* ignore */ }

                    try { ForegroundWindowHelper.TryForceForeground(hwnd); } catch { /* ignore */ }
                }
                catch
                {
                    try { timer.Stop(); } catch { /* ignore */ }
                }
            };

            // Immediate attempt and then a few retries.
            try
            {
                try { NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE); } catch { /* ignore */ }
                ForegroundWindowHelper.TryForceForeground(hwnd);
            }
            catch { /* ignore */ }

            timer.Start();
            window.Closed += (_, _) =>
            {
                try { timer.Stop(); } catch { /* ignore */ }
            };
        }
    }

}
