using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Shell.Views;

/// <summary>
/// Deplace le focus clavier dans la nouvelle vue lorsqu'un ContentControl change de contenu.
/// Evite les annonces NVDA "indisponible" provoquees par la disparition de l'element focalise.
/// </summary>
public static class ContentHostFocusBehavior
{
    public static readonly DependencyProperty EnableProperty =
        DependencyProperty.RegisterAttached(
            "Enable",
            typeof(bool),
            typeof(ContentHostFocusBehavior),
            new PropertyMetadata(false, OnEnableChanged));

    /// <summary>
    /// When enabled, the behavior will skip its first focus attempt for a given host. This is useful to keep
    /// the initial window opening behavior native (no forced focus on startup), while still allowing focus
    /// management on later content changes.
    /// </summary>
    public static readonly DependencyProperty SkipInitialFocusProperty =
        DependencyProperty.RegisterAttached(
            "SkipInitialFocus",
            typeof(bool),
            typeof(ContentHostFocusBehavior),
            new PropertyMetadata(false));

    private sealed class HandlerSet
    {
        public EventHandler? ContentChanged { get; init; }
        public bool SkipInitialFocus { get; init; }
        public bool InitialFocusSkipped { get; set; }
        public Window? ObservedWindow { get; set; }
        public EventHandler? WindowActivated { get; set; }
        public FrameworkElement? ObservedRoot { get; set; }
        public RoutedEventHandler? RootLoaded { get; set; }
        public EventHandler? RootLayoutUpdated { get; set; }
    }

    private static readonly ConditionalWeakTable<ContentControl, HandlerSet> HandlersByHost = new();

    public static void SetEnable(DependencyObject element, bool value) =>
        element.SetValue(EnableProperty, value);

    public static bool GetEnable(DependencyObject element) =>
        (bool)element.GetValue(EnableProperty);

    public static void SetSkipInitialFocus(DependencyObject element, bool value) =>
        element.SetValue(SkipInitialFocusProperty, value);

    public static bool GetSkipInitialFocus(DependencyObject element) =>
        (bool)element.GetValue(SkipInitialFocusProperty);

    private static void OnEnableChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not ContentControl host)
        {
            return;
        }

        var enabled = e.NewValue is true;
        if (enabled)
        {
            Attach(host);
        }
        else
        {
            Detach(host);
        }
    }

    private static void Attach(ContentControl host)
    {
        Detach(host);

        // Observe Content changes via DP descriptor (ContentChanged event does not exist on ContentControl).
        var descriptor = DependencyPropertyDescriptor.FromProperty(ContentControl.ContentProperty, typeof(ContentControl));
        EventHandler changed = (_, _) => FocusFirstInteractive(host);
        descriptor.AddValueChanged(host, changed);

        HandlersByHost.Add(host, new HandlerSet
        {
            ContentChanged = changed,
            SkipInitialFocus = GetSkipInitialFocus(host),
            InitialFocusSkipped = false,
        });

        // Also run once after load.
        host.Dispatcher.BeginInvoke((Action)(() => FocusFirstInteractive(host)), DispatcherPriority.Background);
    }

    private static void Detach(ContentControl host)
    {
        if (!HandlersByHost.TryGetValue(host, out var handlers))
        {
            return;
        }

        try
        {
            var descriptor = DependencyPropertyDescriptor.FromProperty(ContentControl.ContentProperty, typeof(ContentControl));
            if (handlers.ContentChanged != null)
            {
                descriptor.RemoveValueChanged(host, handlers.ContentChanged);
            }
        }
        catch
        {
            // best-effort
        }

        DetachRuntimeObservers(handlers);
        HandlersByHost.Remove(host);
    }

    private static void FocusFirstInteractive(ContentControl host)
    {
        try
        {
            if (!HandlersByHost.TryGetValue(host, out var handlers))
            {
                return;
            }

            if (handlers.SkipInitialFocus && !handlers.InitialFocusSkipped)
            {
                handlers.InitialFocusSkipped = true;
                return;
            }

            var window = Window.GetWindow(host) ?? Application.Current?.MainWindow;
            if (window != null && !window.IsActive)
            {
                HookWindowActivation(host, handlers, window);
                return;
            }

            // NVDA: park focus on a stable element before trying to focus inside the new content.
            try { FocusParking.ParkIfNeeded(window); } catch { }

            host.Dispatcher.BeginInvoke((Action)(() => TryFocus(host, allowFallback: false)), DispatcherPriority.Loaded);
            host.Dispatcher.BeginInvoke((Action)(() => TryFocus(host, allowFallback: true)), DispatcherPriority.ApplicationIdle);
            HookContentRootObservers(host, handlers);
        }
        catch
        {
            // best-effort
        }
    }

    private static bool TryFocus(ContentControl host, bool allowFallback)
    {
        try
        {
            if (!HandlersByHost.TryGetValue(host, out var handlers))
            {
                return false;
            }

            if (TryGetContentRoot(host) is not DependencyObject root)
            {
                return false;
            }

            if (PresentationSource.FromDependencyObject(root) == null)
            {
                return false;
            }

            if (root is IInitialFocusTarget focusTarget)
            {
                if (!IsFocusWithin(root))
                {
                    focusTarget.RequestInitialFocus();
                }

                if (IsFocusWithin(root))
                {
                    DetachRuntimeObservers(handlers);
                    return true;
                }
            }

            if (FindFirstFocusable(root) is IInputElement target)
            {
                if (TrySetKeyboardFocus(target, root))
                {
                    DetachRuntimeObservers(handlers);
                    return true;
                }
            }

            if (allowFallback)
            {
                HookContentRootObservers(host, handlers);
            }

            return false;
        }
        catch
        {
            // best-effort
        }

        return false;
    }

    private static void HookWindowActivation(ContentControl host, HandlerSet handlers, Window window)
    {
        if (ReferenceEquals(handlers.ObservedWindow, window) && handlers.WindowActivated != null)
        {
            return;
        }

        DetachRuntimeObservers(handlers);
        handlers.ObservedWindow = window;
        handlers.WindowActivated = (_, _) =>
        {
            try
            {
                if (TryFocus(host, allowFallback: true))
                {
                    DetachRuntimeObservers(handlers);
                }
                else
                {
                    HookContentRootObservers(host, handlers);
                }
            }
            catch
            {
                // ignore
            }
        };

        try { window.Activated += handlers.WindowActivated; } catch { /* ignore */ }
    }

    private static void HookContentRootObservers(ContentControl host, HandlerSet handlers)
    {
        var root = TryGetContentRoot(host) as FrameworkElement;
        if (root == null)
        {
            return;
        }

        if (ReferenceEquals(handlers.ObservedRoot, root))
        {
            return;
        }

        DetachRootObservers(handlers);
        handlers.ObservedRoot = root;
        handlers.RootLoaded = (_, _) =>
        {
            try
            {
                if (TryFocus(host, allowFallback: true))
                {
                    DetachRuntimeObservers(handlers);
                }
            }
            catch
            {
                // ignore
            }
        };
        handlers.RootLayoutUpdated = (_, _) =>
        {
            try
            {
                if (TryFocus(host, allowFallback: true))
                {
                    DetachRuntimeObservers(handlers);
                }
            }
            catch
            {
                // ignore
            }
        };

        try { root.Loaded += handlers.RootLoaded; } catch { /* ignore */ }
        try { root.LayoutUpdated += handlers.RootLayoutUpdated; } catch { /* ignore */ }
    }

    private static void DetachRuntimeObservers(HandlerSet handlers)
    {
        try
        {
            if (handlers.ObservedWindow != null && handlers.WindowActivated != null)
            {
                handlers.ObservedWindow.Activated -= handlers.WindowActivated;
            }
        }
        catch
        {
            // ignore
        }
        finally
        {
            handlers.ObservedWindow = null;
            handlers.WindowActivated = null;
        }

        DetachRootObservers(handlers);
    }

    private static void DetachRootObservers(HandlerSet handlers)
    {
        try
        {
            if (handlers.ObservedRoot != null)
            {
                if (handlers.RootLoaded != null)
                {
                    handlers.ObservedRoot.Loaded -= handlers.RootLoaded;
                }

                if (handlers.RootLayoutUpdated != null)
                {
                    handlers.ObservedRoot.LayoutUpdated -= handlers.RootLayoutUpdated;
                }
            }
        }
        catch
        {
            // ignore
        }
        finally
        {
            handlers.ObservedRoot = null;
            handlers.RootLoaded = null;
            handlers.RootLayoutUpdated = null;
        }
    }

    private static bool TrySetKeyboardFocus(IInputElement target, DependencyObject expectedRoot)
    {
        try
        {
            if (target is UIElement uiTarget)
            {
                try { uiTarget.Focus(); } catch { /* ignore */ }
            }

            try { Keyboard.Focus(target); } catch { /* ignore */ }

            return IsFocusWithin(expectedRoot);
        }
        catch
        {
            return false;
        }
    }

    private static DependencyObject? TryGetContentRoot(ContentControl host)
    {
        try
        {
            if (host.Content is DependencyObject direct && PresentationSource.FromDependencyObject(direct) != null)
            {
                return direct;
            }

            // If Content is a ViewModel, WPF creates the View via DataTemplate under a ContentPresenter.
            // Find that generated view root in the visual tree.
            if (FindDescendant<ContentPresenter>(host) is ContentPresenter presenter)
            {
                var children = VisualTreeHelper.GetChildrenCount(presenter);
                if (children > 0)
                {
                    return VisualTreeHelper.GetChild(presenter, 0);
                }
            }

            // Fallback: first FrameworkElement that inherited DataContext == host.Content.
            if (host.Content != null &&
                FindDescendant<FrameworkElement>(host, fe =>
                    !ReferenceEquals(fe, host) &&
                    fe is not ContentPresenter &&
                    ReferenceEquals(fe.DataContext, host.Content)) is FrameworkElement dataContextRoot)
            {
                return dataContextRoot;
            }
        }
        catch
        {
            // best-effort
        }

        return null;
    }

    private static T? FindDescendant<T>(DependencyObject root, Func<T, bool>? predicate = null) where T : DependencyObject
    {
        try
        {
            var childrenCount = VisualTreeHelper.GetChildrenCount(root);
            for (var i = 0; i < childrenCount; i++)
            {
                var child = VisualTreeHelper.GetChild(root, i);
                if (child == null)
                {
                    continue;
                }

                if (child is T typed && (predicate?.Invoke(typed) ?? true))
                {
                    return typed;
                }

                if (FindDescendant(child, predicate) is T found)
                {
                    return found;
                }
            }
        }
        catch
        {
            // best-effort
        }

        return null;
    }

    private static DependencyObject? FindFirstFocusable(DependencyObject root)
    {
        // Ignore elements that are not loaded yet.
        if (root is FrameworkElement fe && !fe.IsVisible)
        {
            // still allow traversal - some containers report not visible during template creation
        }

        if (root is Control control &&
            control.IsVisible &&
            control.IsEnabled &&
            control.IsHitTestVisible &&
            (control.Focusable || KeyboardNavigation.GetIsTabStop(control)))
        {
            return control;
        }

        if (root is UIElement uie &&
            uie.IsVisible &&
            uie.IsEnabled &&
            uie.IsHitTestVisible &&
            uie.Focusable)
        {
            return uie;
        }

        var childrenCount = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < childrenCount; i++)
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

        return null;
    }

    private static bool IsFocusWithin(DependencyObject root)
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        if (focused == null)
        {
            return false;
        }

        for (DependencyObject? current = focused; current != null; current = GetParent(current))
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
