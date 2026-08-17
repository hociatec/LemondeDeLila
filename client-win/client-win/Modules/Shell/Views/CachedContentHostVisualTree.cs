using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace client_win.Modules.Shell.Views;

internal static class CachedContentHostVisualTree
{
    public static DependencyObject? TryGetPresenterRoot(ContentPresenter presenter)
    {
        try
        {
            var count = VisualTreeHelper.GetChildrenCount(presenter);
            if (count <= 0)
            {
                return null;
            }

            return VisualTreeHelper.GetChild(presenter, 0);
        }
        catch
        {
            return null;
        }
    }

    public static DependencyObject? FindFirstFocusable(DependencyObject root)
    {
        try
        {
            if (root is Control c &&
                c.IsVisible &&
                c.IsEnabled &&
                c.IsHitTestVisible &&
                (c.Focusable || KeyboardNavigation.GetIsTabStop(c)))
            {
                return c;
            }

            if (root is UIElement u &&
                u.IsVisible &&
                u.IsEnabled &&
                u.IsHitTestVisible &&
                u.Focusable)
            {
                return u;
            }

            var count = VisualTreeHelper.GetChildrenCount(root);
            for (var i = 0; i < count; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child == null)
                {
                    continue;
                }

                var found = FindFirstFocusable(child);
                if (found != null)
                {
                    return found;
                }
            }
        }
        catch
        {
            // ignore
        }

        return null;
    }

    public static bool IsFocusWithin(DependencyObject root)
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        return focused != null && IsDescendantOrSelf(focused, root);
    }

    public static bool IsDescendantOrSelf(DependencyObject child, DependencyObject root)
    {
        for (DependencyObject? current = child; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, root))
            {
                return true;
            }
        }

        return false;
    }

    private static DependencyObject? GetParent(DependencyObject current)
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
            // ignore
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }
}
