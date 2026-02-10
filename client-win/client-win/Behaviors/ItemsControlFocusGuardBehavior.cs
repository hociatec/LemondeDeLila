using System;
using System.Collections.Specialized;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Shell.Services;

namespace client_win.Behaviors;

/// <summary>
/// Global NVDA mitigation: when an ItemsControl refreshes/recycles containers while a ListBoxItem is focused,
/// NVDA can announce "indisponible" because the focused element disappears.
/// This behavior parks focus on a stable element before the refresh, then restores focus after containers regenerate.
/// </summary>
public static class ItemsControlFocusGuardBehavior
{
    public static readonly DependencyProperty EnableProperty =
        DependencyProperty.RegisterAttached(
            "Enable",
            typeof(bool),
            typeof(ItemsControlFocusGuardBehavior),
            new PropertyMetadata(false, OnEnableChanged));

    public static void SetEnable(DependencyObject element, bool value) =>
        element.SetValue(EnableProperty, value);

    public static bool GetEnable(DependencyObject element) =>
        (bool)element.GetValue(EnableProperty);

    private sealed class Subscription
    {
        public ItemsChangedEventHandler? ItemsChanged { get; set; }
        public EventHandler? StatusChanged { get; set; }
        public NotifyCollectionChangedEventHandler? CollectionChanged { get; set; }
        public bool ParkedForRefresh { get; set; }
    }

    private static readonly ConditionalWeakTable<ItemsControl, Subscription> Subscriptions = new();

    private static void OnEnableChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not ItemsControl control)
        {
            return;
        }

        var enabled = e.NewValue is true;
        if (!enabled)
        {
            Detach(control);
            return;
        }

        Attach(control);
    }

    private static void Attach(ItemsControl control)
    {
        Detach(control);

        var sub = new Subscription();
        Subscriptions.Add(control, sub);

        sub.ItemsChanged = (_, args) =>
        {
            try
            {
                if (!IsFocusWithin(control))
                {
                    return;
                }

                // On any structural change, park focus immediately.
                if (args.Action is NotifyCollectionChangedAction.Add
                    or NotifyCollectionChangedAction.Remove
                    or NotifyCollectionChangedAction.Replace
                    or NotifyCollectionChangedAction.Move
                    or NotifyCollectionChangedAction.Reset)
                {
                    sub.ParkedForRefresh = true;
                    FocusParking.ForcePark(Window.GetWindow(control) ?? Application.Current?.MainWindow);
                }
            }
            catch
            {
                // best-effort
            }
        };
        control.ItemContainerGenerator.ItemsChanged += sub.ItemsChanged;

        sub.StatusChanged = (_, _) =>
        {
            try
            {
                if (control.ItemContainerGenerator.Status != GeneratorStatus.ContainersGenerated)
                {
                    return;
                }

                if (!sub.ParkedForRefresh)
                {
                    return;
                }

                sub.ParkedForRefresh = false;

                // Restore focus only if focus is still parked (user didn't move elsewhere).
                if (!IsFocusParked())
                {
                    return;
                }

                control.Dispatcher.BeginInvoke(
                    DispatcherPriority.Loaded,
                    (Action)(() => TryRestoreFocus(control)));
            }
            catch
            {
                // best-effort
            }
        };
        control.ItemContainerGenerator.StatusChanged += sub.StatusChanged;

        // Also listen to Items collection changes (covers ItemsSource swaps).
        if (control.Items is INotifyCollectionChanged notify)
        {
            sub.CollectionChanged = (_, __) =>
            {
                try
                {
                    if (!IsFocusWithin(control))
                    {
                        return;
                    }
                    sub.ParkedForRefresh = true;
                    FocusParking.ForcePark(Window.GetWindow(control) ?? Application.Current?.MainWindow);
                }
                catch
                {
                    // best-effort
                }
            };
            notify.CollectionChanged += sub.CollectionChanged;
        }
    }

    private static void Detach(ItemsControl control)
    {
        if (!Subscriptions.TryGetValue(control, out var sub))
        {
            return;
        }

        try
        {
            if (sub.ItemsChanged != null)
            {
                control.ItemContainerGenerator.ItemsChanged -= sub.ItemsChanged;
            }
        }
        catch { }

        try
        {
            if (sub.StatusChanged != null)
            {
                control.ItemContainerGenerator.StatusChanged -= sub.StatusChanged;
            }
        }
        catch { }

        try
        {
            if (sub.CollectionChanged != null && control.Items is INotifyCollectionChanged notify)
            {
                notify.CollectionChanged -= sub.CollectionChanged;
            }
        }
        catch { }

        Subscriptions.Remove(control);
    }

    private static void TryRestoreFocus(ItemsControl control)
    {
        try
        {
            if (!control.IsVisible || !control.IsEnabled)
            {
                return;
            }

            if (control is Selector selector)
            {
                if (selector.SelectedIndex < 0 && selector.Items.Count > 0)
                {
                    selector.SelectedIndex = 0;
                }

                var selected = selector.SelectedItem;
                if (selected != null)
                {
                    if (control is ListBox lb)
                    {
                        lb.ScrollIntoView(selected);
                    }
                    else if (control is ListView lv)
                    {
                        lv.ScrollIntoView(selected);
                    }
                    else if (control is DataGrid dg)
                    {
                        dg.ScrollIntoView(selected);
                    }
                    selector.UpdateLayout();
                    if (selector.ItemContainerGenerator.ContainerFromItem(selected) is UIElement item)
                    {
                        item.Focus();
                        Keyboard.Focus(item);
                        return;
                    }
                }
            }

            control.Focus();
            Keyboard.Focus(control);
        }
        catch
        {
            // best-effort
        }
    }

    private static bool IsFocusWithin(ItemsControl control)
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        if (focused == null)
        {
            return false;
        }

        for (DependencyObject? current = focused; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, control))
            {
                return true;
            }
        }

        return false;
    }

    private static bool IsFocusParked()
    {
        var focused = Keyboard.FocusedElement;
        if (focused is FrameworkElement fe)
        {
            var name = fe.Name ?? string.Empty;
            if (string.Equals(name, "FocusSentinel", StringComparison.Ordinal) ||
                string.Equals(name, "RootHost", StringComparison.Ordinal))
            {
                return true;
            }
        }
        return focused is Window;
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
