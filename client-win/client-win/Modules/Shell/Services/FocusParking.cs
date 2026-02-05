using System;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Input;
using System.Windows.Interop;
using System.Linq;
using System.Windows.Threading;

namespace client_win.Modules.Shell.Services;

public static class FocusParking
{
    public static void Park(Window? window = null)
    {
        try
        {
            window ??= Application.Current?.Windows.OfType<Window>().FirstOrDefault(w => w.IsActive)
                      ?? Application.Current?.MainWindow;
            if (window == null)
            {
                return;
            }

            // Important: never steal focus back from other applications.
            // We only "park" focus if this window is active (or already has keyboard focus within).
            if (!window.IsActive && !window.IsKeyboardFocusWithin)
            {
                return;
            }

            void ParkOnUiThread()
            {
                try
                {
                    // 1) UIA focus: tends to be more reliable for NVDA than WPF keyboard focus alone.
                    try
                    {
                        var hwnd = new WindowInteropHelper(window).Handle;
                        if (hwnd != IntPtr.Zero)
                        {
                            // Avoid re-activating the window: only set UIA focus while already active.
                            if (window.IsActive)
                            {
                                AutomationElement.FromHandle(hwnd)?.SetFocus();
                            }
                        }
                    }
                    catch
                    {
                        // ignore
                    }

                    // 2) Keyboard focus: ensure the focused element is not about to be removed/collapsed.
                    var target =
                        // Prefer the content host: it's a stable, visible element (NVDA can announce "indisponible"
                        // when focusing an invisible sentinel during heavy navigation).
                        window.FindName("RootHost") as IInputElement ??
                        window.FindName("FocusSentinel") as IInputElement ??
                        window;
                    try { (target as UIElement)?.Focus(); } catch { /* ignore */ }
                    try { Keyboard.Focus(target); } catch { /* ignore */ }
                }
                catch
                {
                    // best-effort
                }
            }

            if (window.Dispatcher.CheckAccess())
            {
                ParkOnUiThread();
            }
            else
            {
                // IMPORTANT (NVDA):
                // This must be synchronous when called from a background thread, otherwise the caller may
                // swap/destroy the focused element before we "park" focus, which leads to "indisponible".
                window.Dispatcher.Invoke((Action)ParkOnUiThread, DispatcherPriority.Send);
            }
        }
        catch
        {
            // best-effort
        }
    }
}
