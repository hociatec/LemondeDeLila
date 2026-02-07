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
                    // Keyboard focus: ensure the focused element is not about to be removed/collapsed.
                    var target =
                        // Prefer the content host: it's a stable, visible element (NVDA can announce "indisponible"
                        // when focusing an invisible sentinel during heavy navigation).
                        window.FindName("RootHost") as IInputElement ??
                        window.FindName("FocusSentinel") as IInputElement ??
                        window;
                    Log.Debug("FocusParking.Park target={Target} windowActive={IsActive} keyboardWithin={KeyboardWithin}",
                        target?.GetType().Name ?? "<null>",
                        window.IsActive,
                        window.IsKeyboardFocusWithin);
                    try { (target as UIElement)?.Focus(); } catch { /* ignore */ }
                    try { Keyboard.Focus(target); } catch { /* ignore */ }

                    // UIA focus: align with the parked target, not the top-level window handle.
                    // Forcing UIA focus to the window can leave NVDA stuck on "fenêtre" after startup.
                    try
                    {
                        if (target is UIElement uiTarget && uiTarget.IsVisible && uiTarget.IsEnabled)
                        {
                            var peer = UIElementAutomationPeer.FromElement(uiTarget) ?? UIElementAutomationPeer.CreatePeerForElement(uiTarget);
                            if (peer != null)
                            {
                                Log.Debug("FocusParking.Park UIA focus target={Target}", uiTarget.GetType().Name);
                                try { peer.SetFocus(); } catch { /* ignore */ }
                                try { peer.RaiseAutomationEvent(AutomationEvents.AutomationFocusChanged); } catch { /* ignore */ }
                            }
                        }
                    }
                    catch
                    {
                        // ignore
                    }
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
