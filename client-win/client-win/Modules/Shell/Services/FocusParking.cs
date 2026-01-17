using System;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;

namespace client_win.Modules.Shell.Services;

public static class FocusParking
{
    public static void Park()
    {
        try
        {
            var window = Application.Current?.MainWindow;
            if (window == null)
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
                            AutomationElement.FromHandle(hwnd)?.SetFocus();
                        }
                    }
                    catch
                    {
                        // ignore
                    }

                    // 2) Keyboard focus: ensure the focused element is not about to be removed/collapsed.
                    var target = window.FindName("RootHost") as IInputElement ?? window;
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
                _ = window.Dispatcher.BeginInvoke((Action)ParkOnUiThread, DispatcherPriority.Send);
            }
        }
        catch
        {
            // best-effort
        }
    }
}

