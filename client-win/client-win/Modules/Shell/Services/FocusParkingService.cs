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
                    // Clear focus so the previous view can be removed without SR "unavailable" announcements.
                    try { Keyboard.ClearFocus(); } catch { /* ignore */ }
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
