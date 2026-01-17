using System;
using System.Windows;
using System.Windows.Input;

namespace client_win.Modules.Shell.Services;

public static class NvdaDialogFocus
{
    public static void Configure(Window dialog, Window? owner = null, Func<IInputElement?>? focusTargetFactory = null)
    {
        if (dialog == null) throw new ArgumentNullException(nameof(dialog));

        try
        {
            // IMPORTANT (NVDA): avoid shifting focus to a not-yet-rendered dialog.
            // We'll activate it once ContentRendered fires.
            dialog.ShowActivated = false;
        }
        catch
        {
            // ignore
        }

        EventHandler? handler = null;
        handler = (_, _) =>
        {
            try { dialog.ContentRendered -= handler; } catch { /* ignore */ }

            try
            {
                // Ensure focus is not left on an element that is about to disappear in the owner.
                FocusParking.Park(owner);
            }
            catch
            {
                // ignore
            }

            try { dialog.Activate(); } catch { /* ignore */ }

            try
            {
                var target = focusTargetFactory?.Invoke();
                if (target is UIElement ui && ui.IsVisible && ui.IsEnabled)
                {
                    ui.Focus();
                    Keyboard.Focus(target);
                }
            }
            catch
            {
                // ignore
            }
        };

        dialog.ContentRendered += handler;
    }
}

