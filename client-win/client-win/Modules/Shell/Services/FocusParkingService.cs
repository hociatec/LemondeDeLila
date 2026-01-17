using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;

namespace client_win.Modules.Shell.Services;

public sealed class FocusParkingService : IFocusParkingService
{
    public void ParkFocus()
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
                    // Park focus on a stable, visible element to avoid NVDA announcing "unavailable"
                    // when the previous focused element is removed during navigation.
                    var target = window.FindName("RootHost") as IInputElement
                                 ?? window;
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
