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
                    var parking = window.FindName("FocusParking") as IInputElement ?? window;
                    try { Keyboard.ClearFocus(); } catch { /* ignore */ }
                    try { (parking as UIElement)?.Focus(); } catch { /* ignore */ }
                    try { Keyboard.Focus(parking); } catch { /* ignore */ }
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

