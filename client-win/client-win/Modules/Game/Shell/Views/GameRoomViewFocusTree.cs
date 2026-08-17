using System.Windows;
using System.Windows.Media;

namespace client_win.Modules.Game.Shell.Views;

internal static class GameRoomViewFocusTree
{
    public static bool IsFocusWithinElement(
        DependencyObject root,
        DependencyObject? focused)
    {
        while (focused != null)
        {
            if (ReferenceEquals(focused, root))
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    public static DependencyObject? GetVisualOrLogicalParent(
        DependencyObject current)
    {
        try
        {
            if (current is Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return VisualTreeHelper.GetParent(current);
            }
        }
        catch
        {
            // fallback below
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }
}
