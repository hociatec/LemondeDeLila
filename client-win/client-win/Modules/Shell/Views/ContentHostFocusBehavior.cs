using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace client_win.Modules.Shell.Views;

/// <summary>
/// Déplace le focus clavier dans la nouvelle vue lorsqu'un ContentControl change de contenu.
/// Évite les annonces NVDA "indisponible" provoquées par la disparition de l'élément focalisé.
/// </summary>
public static class ContentHostFocusBehavior
{
    public static readonly DependencyProperty EnableProperty =
        DependencyProperty.RegisterAttached(
            "Enable",
            typeof(bool),
            typeof(ContentHostFocusBehavior),
            new PropertyMetadata(false, OnEnableChanged));

    private sealed class HandlerSet
    {
        public EventHandler? ContentChanged { get; init; }
    }

    private static readonly ConditionalWeakTable<ContentControl, HandlerSet> HandlersByHost = new();

    public static void SetEnable(DependencyObject element, bool value) =>
        element.SetValue(EnableProperty, value);

    public static bool GetEnable(DependencyObject element) =>
        (bool)element.GetValue(EnableProperty);

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

        HandlersByHost.Add(host, new HandlerSet { ContentChanged = changed });

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

        HandlersByHost.Remove(host);
    }

    private static void FocusFirstInteractive(ContentControl host)
    {
        try
        {
            // Parking focus: placer le focus sur un élément stable (le host) pendant la transition,
            // pour éviter que NVDA tente d'annoncer un élément qui vient d'être détruit.
            var parking = TryFindParkingElement(host) ?? host;
            try { (parking as UIElement)?.Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(parking); } catch { /* ignore */ }

            void TryFocus()
            {
                try
                {
                    if (host.Content is not DependencyObject root)
                    {
                        return;
                    }

                    if (FindFirstFocusable(root) is IInputElement target)
                    {
                        Keyboard.Focus(target);
                        return;
                    }

                    // Fallback: tenter un MoveFocus à partir du host.
                    if (host.IsVisible)
                    {
                        host.MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
                    }
                }
                catch
                {
                    // best-effort
                }
            }

            // Essai rapide dès que la vue est chargée + essai tardif une fois idle.
            host.Dispatcher.BeginInvoke((Action)TryFocus, DispatcherPriority.Loaded);
            host.Dispatcher.BeginInvoke((Action)TryFocus, DispatcherPriority.ApplicationIdle);
        }
        catch
        {
            // best-effort
        }
    }

    private static IInputElement? TryFindParkingElement(ContentControl host)
    {
        try
        {
            var window = Window.GetWindow(host);
            if (window == null)
            {
                return null;
            }

            if (window.FindName("FocusParking") is IInputElement parking)
            {
                return parking;
            }
        }
        catch
        {
            // ignore
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
            (control.Focusable || KeyboardNavigation.GetIsTabStop(control)))
        {
            return control;
        }

        if (root is UIElement uie &&
            uie.IsVisible &&
            uie.IsEnabled &&
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
}
