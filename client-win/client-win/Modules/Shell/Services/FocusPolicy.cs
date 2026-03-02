using System.Windows;

namespace client_win.Modules.Shell.Services;

public enum FocusPolicyReason
{
    InitialLoad,
    Update,
    UserRequest
}

public static class FocusPolicy
{
    public static bool CanFocus(DependencyObject target, FocusPolicyReason reason)
    {
        if (target == null)
        {
            return false;
        }

        if (target is UIElement ui)
        {
            return ui.IsVisible && ui.IsEnabled;
        }

        return true;
    }
}
