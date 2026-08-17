using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using Serilog;

namespace client_win
{
    internal static class SingleInstanceActivator
    {
        public static void TryActivateExistingInstance()
        {
            var current = Process.GetCurrentProcess();
            var candidates = Process.GetProcessesByName(current.ProcessName)
                .Where(p => p != null && p.Id != current.Id)
                .ToList();

            foreach (var process in candidates)
            {
                try
                {
                    for (var i = 0; i < 20; i++)
                    {
                        process.Refresh();
                        if (process.MainWindowHandle != IntPtr.Zero)
                        {
                            break;
                        }

                        Thread.Sleep(50);
                    }

                    var hwnd = process.MainWindowHandle;
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
        public const int WM_HOTKEY = 0x0312;
        public const int HOTKEY_ID_ACTIVATE = 1;
        public const uint MOD_ALT = 0x0001;
        public const uint MOD_CONTROL = 0x0002;
        public const uint MOD_SHIFT = 0x0004;
        public const uint VK_L = 0x4C;
        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOACTIVATE = 0x0010;
        public const uint SWP_SHOWWINDOW = 0x0040;
        public const uint FLASHW_STOP = 0;
        public const uint FLASHW_CAPTION = 1;
        public const uint FLASHW_TRAY = 2;
        public const uint FLASHW_ALL = 3;
        public const uint FLASHW_TIMERNOFG = 12;

        public static readonly IntPtr HWND_TOPMOST = new(-1);
        public static readonly IntPtr HWND_NOTOPMOST = new(-2);

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

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
        public static extern bool SetWindowPos(
            IntPtr hWnd,
            IntPtr hWndInsertAfter,
            int X,
            int Y,
            int cx,
            int cy,
            uint uFlags);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        [DllImport("user32.dll")]
        public static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

        [StructLayout(LayoutKind.Sequential)]
        public struct FLASHWINFO
        {
            public uint cbSize;
            public IntPtr hwnd;
            public uint dwFlags;
            public uint uCount;
            public uint dwTimeout;
        }

        public static void FlashWindowUntilForeground(IntPtr hwnd)
        {
            try
            {
                var info = new FLASHWINFO
                {
                    cbSize = (uint)Marshal.SizeOf<FLASHWINFO>(),
                    hwnd = hwnd,
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

                    try
                    {
                        if (NativeMethods.GetForegroundWindow() != hwnd)
                        {
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
            Log.Debug("StartupActivationHelper.Begin (hwnd={Hwnd})", hwnd);

            timer.Tick += (_, _) =>
            {
                try
                {
                    attempts++;
                    Log.Debug(
                        "StartupActivationHelper attempt {Attempt}/{MaxAttempts} (IsActive={IsActive}, IsVisible={IsVisible})",
                        attempts,
                        MaxAttempts,
                        window.IsActive,
                        window.IsVisible);

                    if (!window.IsVisible)
                    {
                        Log.Debug("StartupActivationHelper: window not visible, skipping attempt");
                        return;
                    }

                    if (window.IsActive)
                    {
                        Log.Debug("StartupActivationHelper: window became active on attempt {Attempt}", attempts);
                        timer.Stop();
                        return;
                    }

                    if (attempts >= MaxAttempts)
                    {
                        Log.Warning("StartupActivationHelper: max attempts reached without activation");
                        ActivationHelpers.FlashWindowTopmost(window);
                        timer.Stop();
                        return;
                    }

                    try { if (window.WindowState == WindowState.Minimized) window.WindowState = WindowState.Normal; } catch { /* ignore */ }
                    try { NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE); } catch { /* ignore */ }

                    try
                    {
                        ForegroundWindowHelper.TryForceForeground(hwnd);
                        Log.Debug("StartupActivationHelper: TryForceForeground invoked on attempt {Attempt}", attempts);
                    }
                    catch (Exception ex)
                    {
                        Log.Warning(ex, "StartupActivationHelper: TryForceForeground failed on attempt {Attempt}", attempts);
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "StartupActivationHelper tick failed");
                    try { timer.Stop(); } catch { /* ignore */ }
                }
            };

            try
            {
                try { NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE); } catch { /* ignore */ }
                ForegroundWindowHelper.TryForceForeground(hwnd);
                Log.Debug("StartupActivationHelper: immediate ForegroundHelper request");
            }
            catch
            {
                // ignore
            }

            timer.Start();
            window.Closed += (_, _) =>
            {
                try { timer.Stop(); } catch { /* ignore */ }
            };
        }
    }

    internal static class ActivationHelpers
    {
        public static void FlashWindowTopmost(Window window)
        {
            if (window == null)
            {
                return;
            }

            try
            {
                window.Dispatcher.BeginInvoke((Action)(() =>
                {
                    try
                    {
                        var originalTopmost = window.Topmost;
                        if (!originalTopmost)
                        {
                            window.Topmost = true;
                        }

                        var timer = new DispatcherTimer(DispatcherPriority.ApplicationIdle, window.Dispatcher)
                        {
                            Interval = TimeSpan.FromMilliseconds(120),
                        };
                        timer.Tick += (_, _) =>
                        {
                            timer.Stop();
                            try
                            {
                                if (!originalTopmost)
                                {
                                    window.Topmost = originalTopmost;
                                }
                            }
                            catch (Exception ex)
                            {
                                Log.Warning(ex, "FlashWindowTopmost: failed to restore Topmost");
                            }
                        };
                        timer.Start();
                    }
                    catch (Exception ex)
                    {
                        Log.Warning(ex, "FlashWindowTopmost failed");
                    }
                }), DispatcherPriority.Background);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "FlashWindowTopmost dispatch failed");
            }
        }
    }

    internal static class AnimationDisabler
    {
        private const double MinimumSpeedRatio = 1_000_000.0;
        private static bool _disabled;

        public static void Disable()
        {
            if (_disabled)
            {
                return;
            }

            _disabled = true;
            try
            {
                Timeline.SpeedRatioProperty.OverrideMetadata(
                    typeof(Timeline),
                    new FrameworkPropertyMetadata(
                        defaultValue: MinimumSpeedRatio,
                        FrameworkPropertyMetadataOptions.None,
                        propertyChangedCallback: null,
                        coerceValueCallback: CoerceToMinimum));
            }
            catch (ArgumentException)
            {
                // Best-effort: OverrideMetadata throws if already applied for the type.
                // In some hosting/load scenarios (ClickOnce, multiple load contexts), this can happen even if our static guard runs.
            }
        }

        private static object CoerceToMinimum(DependencyObject _, object baseValue)
        {
            if (baseValue is double ratio && double.IsFinite(ratio))
            {
                return Math.Max(MinimumSpeedRatio, ratio);
            }

            return MinimumSpeedRatio;
        }
    }
}
