using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.ComponentModel;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Data;
using System.Windows.Interop;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core.Accessibility;
using client_win.Core.Text;
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
using Serilog;

namespace client_win
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private Mutex? _singleInstanceMutex;
        private bool _ownsSingleInstanceMutex;
        private SingleInstanceHandle? _singleInstanceHandle;

        protected override void OnStartup(StartupEventArgs e)
        {
            AnimationDisabler.Disable();
            GlobalUiTextRepair.Initialize();
            string? appDataPath = null;
            var boot = Stopwatch.StartNew();
            try
            {
                appDataPath = EnsureAppDataPath();
                TryAppendStartupLog(appDataPath, "OnStartup: begin");
            }
            catch
            {
                // ignore (best-effort)
            }

            // Empêche l'ouverture de plusieurs fenêtres/applications quand l'utilisateur relance le client
            // (raccourci, clickonce, restart update, etc.).
            const string mutexName = "LeMondeDeLila.Client.SingleInstance";
            try
            {
                _singleInstanceMutex = new Mutex(initiallyOwned: true, name: mutexName, createdNew: out var createdNew);
                _ownsSingleInstanceMutex = createdNew;
                if (!createdNew)
                {
                    if (!string.IsNullOrWhiteSpace(appDataPath))
                    {
                        TryAppendStartupLog(appDataPath, "Single-instance: existing instance detected (mutex)");
                    }

                    // Une instance existe déjà : tenter de la ramener au premier plan et quitter.
                    try
                    {
                        SingleInstanceActivator.TryActivateExistingInstance();
                    }
                    catch
                    {
                        // ignore (best-effort)
                    }

                    try
                    {
                        MessageBox.Show(
                            "Le Monde de Lila est déjà ouvert.\n\n" +
                            "Solution : ouvre le Gestionnaire des tâches et termine \"LeMondeDeLila\" si la fenêtre est invisible, puis relance.",
                            "Le Monde de Lila",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    }
                    catch
                    {
                        // ignore
                    }
                    Shutdown();
                    return;
                }
            }
            catch
            {
                // Best-effort: si le mutex échoue, on laisse l'app démarrer normalement.
            }
            if (!string.IsNullOrWhiteSpace(appDataPath)) TryAppendStartupLog(appDataPath, $"OnStartup: single-instance ok (+{boot.ElapsedMilliseconds}ms)");

            // Fallback/renfort : lockfile dans AppData (plus robuste avec ClickOnce/relances rapides).
            // Si un autre process détient le lock, on active l'instance existante et on quitte.
            try
            {
                appDataPath ??= EnsureAppDataPath();
                var lockPath = Path.Combine(appDataPath, "single-instance.lock");
                _singleInstanceHandle = SingleInstanceHandle.Acquire(lockPath);
            }
            catch (Exception ex)
            {
                if (!string.IsNullOrWhiteSpace(appDataPath))
                {
                    TryAppendStartupLog(appDataPath, "Single-instance: failed to acquire lock file", ex);
                }
                try { SingleInstanceActivator.TryActivateExistingInstance(); } catch { /* ignore */ }
                try
                {
                    MessageBox.Show(
                        "Impossible de démarrer (verrou d'instance).\n\n" +
                        "Vérifie qu'aucun processus \"LeMondeDeLila\" n'est en cours dans le Gestionnaire des tâches.\n\n" +
                        "Un log peut être présent dans %LOCALAPPDATA%\\LeMondeDeLila\\startup.log",
                        "Le Monde de Lila",
                        MessageBoxButton.OK,
                        MessageBoxImage.Error);
                }
                catch
                {
                    // ignore
                }
                Shutdown();
                return;
            }
            if (!string.IsNullOrWhiteSpace(appDataPath)) TryAppendStartupLog(appDataPath, $"OnStartup: lockfile ok (+{boot.ElapsedMilliseconds}ms)");

            base.OnStartup(e);
            if (!string.IsNullOrWhiteSpace(appDataPath)) TryAppendStartupLog(appDataPath, $"OnStartup: base.OnStartup done (+{boot.ElapsedMilliseconds}ms)");

            var window = new MainWindow();
            MainWindow = window;

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

            // IMPORTANT (NVDA / clavier) :
            // On installe d'abord les hooks SourceInitialized, puis on montre la fenêtre.
            // Sinon SourceInitialized peut déjà être passé et on perd les retries d'activation au démarrage.
            try { window.Show(); } catch { /* best-effort */ }
            if (!string.IsNullOrWhiteSpace(appDataPath)) TryAppendStartupLog(appDataPath, $"OnStartup: window.Show called (+{boot.ElapsedMilliseconds}ms)");

            _ = BuildAndShowShellAsync(window);
        }

        private async Task BuildAndShowShellAsync(MainWindow window)
        {
            var appDataPath = EnsureAppDataPath();
            var boot = Stopwatch.StartNew();
            TryAppendStartupLog(appDataPath, "BuildAndShowShellAsync: begin");

            AppHost? host = null;
            try
            {
                TryAppendStartupLog(appDataPath, $"BuildAndShowShellAsync: building host (bg) (+{boot.ElapsedMilliseconds}ms)");
                host = await Task.Run(() => AppBootstrapper.Build()).ConfigureAwait(false);
                TryAppendStartupLog(appDataPath, $"BuildAndShowShellAsync: host built (+{boot.ElapsedMilliseconds}ms)");
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
                TryAppendStartupLog(appDataPath, $"BuildAndShowShellAsync: services prewarmed (+{boot.ElapsedMilliseconds}ms)");

                await await window.Dispatcher.InvokeAsync(async () =>
                {
                    TryAppendStartupLog(appDataPath, $"BuildAndShowShellAsync: dispatcher enter (+{boot.ElapsedMilliseconds}ms)");
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
                    TryAppendStartupLog(appDataPath, $"BuildAndShowShellAsync: ShowHomeForStartup (+{boot.ElapsedMilliseconds}ms)");

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
                            Log.Debug("EnsureActive: start (IsActive={IsActive}, IsVisible={IsVisible}, WindowState={WindowState})",
                                window.IsActive, window.IsVisible, window.WindowState);

                            if (window.IsActive && window.IsKeyboardFocusWithin)
                            {
                                Log.Debug("EnsureActive: window already active");
                                return;
                            }

                            window.Activate();
                            window.Focus();
                            var focused = Keyboard.Focus(window);
                            Log.Debug("EnsureActive: post-focus (IsActive={IsActive}, Focused={Focused})",
                                window.IsActive, focused?.GetType().Name ?? "<null>");
                        }
                        catch (Exception ex)
                        {
                            Log.Warning(ex, "EnsureActive failed");
                        }
                    }

                    EnsureActive();
                    _ = window.Dispatcher.BeginInvoke((Action)EnsureActive, DispatcherPriority.Input);
                    _ = window.Dispatcher.BeginInvoke((Action)EnsureActive, DispatcherPriority.ApplicationIdle);

                    void EnsureForeground()
                    {
                    try
                    {
                        Log.Debug("EnsureForeground: start (IsVisible={IsVisible}, IsActive={IsActive}, WindowState={WindowState})",
                            window.IsVisible, window.IsActive, window.WindowState);

                            if (!window.IsVisible)
                            {
                                Log.Debug("EnsureForeground: window not visible, skipping");
                                return;
                            }

                            var hwnd = new WindowInteropHelper(window).Handle;
                            if (hwnd == IntPtr.Zero)
                            {
                                Log.Debug("EnsureForeground: hwnd zero, skipping");
                                return;
                            }

                            var foreground = NativeMethods.GetForegroundWindow();
                            if (window.IsActive && foreground == hwnd)
                            {
                                Log.Debug("EnsureForeground: already foreground, skipping");
                                return;
                            }

                            NativeMethods.ShowWindow(hwnd, NativeMethods.SW_SHOW);
                            ForegroundWindowHelper.TryForceForeground(hwnd);
                            Log.Debug("EnsureForeground: foreground request issued (ForegroundWindow={Foreground})",
                                NativeMethods.GetForegroundWindow());

                            if (!window.IsActive)
                            {
                            Log.Debug("EnsureForeground: window still inactive, flashing topmost");
                            ActivationHelpers.FlashWindowTopmost(window);
                            }
                        }
                        catch (Exception ex)
                        {
                            Log.Warning(ex, "EnsureForeground failed");
                        }
                    }

                    EnsureForeground();
                    _ = window.Dispatcher.BeginInvoke((Action)EnsureForeground, DispatcherPriority.Input);
                    _ = window.Dispatcher.BeginInvoke((Action)EnsureForeground, DispatcherPriority.ApplicationIdle);

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
                        var activationTick = 0;

                        activationTimer.Tick += (_, _) =>
                        {
                            activationTick++;
                            Log.Debug("Activation timer tick {Tick} start (IsVisible={IsVisible}, IsActive={IsActive})",
                                activationTick, window.IsVisible, window.IsActive);
                            try
                            {
                                activationTimer.Stop();

                                if (!window.IsVisible || window.IsActive)
                                {
                                    Log.Debug("Activation timer exit (IsVisible={IsVisible}, IsActive={IsActive})",
                                        window.IsVisible, window.IsActive);
                                    return;
                                }

                                var hwnd = new WindowInteropHelper(window).Handle;
                                if (hwnd != IntPtr.Zero)
                                {
                                    try { NativeMethods.FlashWindowUntilForeground(hwnd); } catch (Exception ex)
                                    {
                                        Log.Warning(ex, "FlashWindowUntilForeground failed");
                                    }
                                }

                                Log.Warning("Window inactive after {Ticks} ticks; announcing NVDA reminder", activationTick);
                                ActivationHelpers.FlashWindowTopmost(window);
                                announcer.AnnounceAssertiveEvenIfInactive(
                                    "Le Monde de Lila n'est pas actif. Faites Alt+Tab pour revenir sur la fenêtre, ou appuyez sur Contrôle Alt Majuscule L pour activer la fenêtre.");
                            }
                            catch (Exception ex)
                            {
                                Log.Warning(ex, "Activation timer handler failed");
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
                        TryAppendStartupLog(appDataPath, $"BuildAndShowShellAsync: shell.OnLoadedAsync done (+{boot.ElapsedMilliseconds}ms)");
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
                try { _singleInstanceHandle?.Dispose(); } catch { /* ignore */ }
                _singleInstanceHandle = null;
            }

            base.OnExit(e);
        }
    }
}
