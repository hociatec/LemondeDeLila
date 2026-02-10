using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Shell.Services;

public static class DialogFocusRestorer
{
    public static void Restore(Window? owner, IInputElement? previousFocus)
    {
        try
        {
            var dispatcher = Application.Current?.Dispatcher;
            if (dispatcher == null)
            {
                return;
            }

            void TryRestore()
            {
                try
                {
                    if (previousFocus is UIElement ui && ui.IsVisible && ui.IsEnabled)
                    {
                        ui.Focus();
                        Keyboard.Focus(ui);
                        return;
                    }

                    // Fallback: if the previous element was virtualized/unloaded, restore focus in current content.
                    if (owner != null)
                    {
                        var rootHost = owner.FindName("RootHost");
                        if (rootHost is ICurrentContentRootProvider rootProvider)
                        {
                            var root = rootProvider.TryGetCurrentContentRoot();
                            if (root != null && PresentationSource.FromDependencyObject(root) != null)
                            {
                                if (root is IInitialFocusTarget initialFocusTarget)
                                {
                                    try { initialFocusTarget.RequestInitialFocus(); } catch { /* ignore */ }
                                    if (Keyboard.FocusedElement is DependencyObject focused &&
                                        IsDescendantOrSelf(focused, root))
                                    {
                                        return;
                                    }
                                }

                                if (FindFirstFocusable(root) is IInputElement target)
                                {
                                    try { (target as UIElement)?.Focus(); } catch { /* ignore */ }
                                    try { Keyboard.Focus(target); } catch { /* ignore */ }
                                    return;
                                }
                            }
                        }
                    }

                    if (owner != null)
                    {
                        owner.Focus();
                        Keyboard.Focus(owner);
                    }
                }
                catch
                {
                    // ignore
                }
            }

            dispatcher.BeginInvoke((Action)TryRestore, System.Windows.Threading.DispatcherPriority.Input);
            dispatcher.BeginInvoke((Action)TryRestore, System.Windows.Threading.DispatcherPriority.ApplicationIdle);
        }
        catch
        {
            // ignore
        }
    }

    private static bool IsDescendantOrSelf(DependencyObject child, DependencyObject root)
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

    private static DependencyObject? FindFirstFocusable(DependencyObject root)
    {
        try
        {
            if (root is Control c &&
                c.IsVisible &&
                c.IsEnabled &&
                c.Focusable &&
                KeyboardNavigation.GetIsTabStop(c))
            {
                return c;
            }
        }
        catch
        {
            // ignore
        }

        try
        {
            var count = VisualTreeHelper.GetChildrenCount(root);
            for (int i = 0; i < count; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
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
}
