using System;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Input;
using System.Linq;
using System.Windows.Threading;
using Serilog;

namespace client_win.Modules.Shell.Services;

public static class FocusParking
{
    public static void Park(Window? window = null)
    {
        // Default behavior: callers typically invoke Park() just before a navigation
        // that may remove the currently focused control.
        ParkCore(window, force: true);
    }

    public static void ParkIfNeeded(Window? window = null)
    {
        ParkCore(window, force: false);
    }

    public static void ForcePark(Window? window = null)
    {
        ParkCore(window, force: true);
    }

    private static void ParkCore(Window? window, bool force)
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

            // Avoid repetitive announcements: if focus is already parked on a stable host element, don't churn it.
            try
            {
                var focused = Keyboard.FocusedElement;
                if (focused is Window)
                {
                    return;
                }
                if (focused is FrameworkElement fe)
                {
                    var name = fe.Name ?? string.Empty;
                    if (string.Equals(name, "RootHost", StringComparison.Ordinal) ||
                        string.Equals(name, "FocusSentinel", StringComparison.Ordinal))
                    {
                        if (!force)
                        {
                            return;
                        }
                    }
                }
            }
            catch
            {
                // ignore
            }

            if (!force && IsCurrentFocusHealthyForWindow(window))
            {
                // Soft mode: avoid unnecessary focus churn/announcements when focus is already valid.
                return;
            }

            void ParkOnUiThread()
            {
                try
                {
                    // Keyboard focus: ensure the focused element is not about to be removed/collapsed.
                    //
                    // NVDA reliability:
                    // - Parking on an "invisible" sentinel often triggers "indisponible".
                    // - Parking on a ContentControl host may still be announced as unavailable depending on UIA.
                    // The Window itself is stable and consistently announced.
                    var target = (IInputElement)window;
                    Log.Debug("FocusParking.Park target={Target} windowActive={IsActive} keyboardWithin={KeyboardWithin}",
                        target?.GetType().Name ?? "<null>",
                        window.IsActive,
                        window.IsKeyboardFocusWithin);
                    try { (target as UIElement)?.Focus(); } catch { /* ignore */ }
                    try { Keyboard.Focus(target); } catch { /* ignore */ }

                    // Intentionally avoid forcing UIA focus events here.
                    // Repeated synthetic UIA focus changes can trigger noisy "indisponible" announcements in NVDA.
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

    private static bool IsCurrentFocusHealthyForWindow(Window window)
    {
        try
        {
            var focused = Keyboard.FocusedElement as DependencyObject;
            if (focused == null)
            {
                return false;
            }

            var owner = Window.GetWindow(focused);
            if (owner != null && !ReferenceEquals(owner, window))
            {
                return false;
            }

            if (PresentationSource.FromDependencyObject(focused) == null)
            {
                return false;
            }

            if (focused is UIElement ui)
            {
                return ui.IsVisible && ui.IsEnabled;
            }

            if (focused is FrameworkElement fe)
            {
                return fe.IsVisible && fe.IsEnabled;
            }

            return true;
        }
        catch
        {
            return false;
        }
    }
}
