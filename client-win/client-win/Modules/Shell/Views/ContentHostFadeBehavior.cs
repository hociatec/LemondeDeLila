using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;

namespace client_win.Modules.Shell.Views;

public static class ContentHostFadeBehavior
{
    public static readonly DependencyProperty EnableProperty = DependencyProperty.RegisterAttached(
        "Enable",
        typeof(bool),
        typeof(ContentHostFadeBehavior),
        new PropertyMetadata(false, OnEnableChanged));

    private sealed class HandlerSet
    {
        public DependencyPropertyDescriptor? Descriptor { get; set; }
        public EventHandler? ContentChangedHandler { get; set; }
        public bool IsAttached { get; set; }
        public int Version { get; set; }
    }

    private static readonly ConditionalWeakTable<ContentControl, HandlerSet> HandlersByHost = new();

    public static bool GetEnable(DependencyObject obj) => (bool)obj.GetValue(EnableProperty);

    public static void SetEnable(DependencyObject obj, bool value) => obj.SetValue(EnableProperty, value);

    private static void OnEnableChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not ContentControl host)
        {
            return;
        }

        var enabled = e.NewValue is bool b && b;
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
        var handlers = HandlersByHost.GetOrCreateValue(host);
        if (handlers.IsAttached)
        {
            return;
        }

        var descriptor = DependencyPropertyDescriptor.FromProperty(ContentControl.ContentProperty, typeof(ContentControl));
        if (descriptor == null)
        {
            return;
        }

        EventHandler handler = (_, __) => FadeInOnContentChange(host, handlers);
        descriptor.AddValueChanged(host, handler);

        handlers.Descriptor = descriptor;
        handlers.ContentChangedHandler = handler;
        handlers.IsAttached = true;
    }

    private static void Detach(ContentControl host)
    {
        if (!HandlersByHost.TryGetValue(host, out var handlers) || !handlers.IsAttached)
        {
            return;
        }

        try
        {
            if (handlers.Descriptor != null && handlers.ContentChangedHandler != null)
            {
                handlers.Descriptor.RemoveValueChanged(host, handlers.ContentChangedHandler);
            }
        }
        catch
        {
            // best-effort
        }

        handlers.Descriptor = null;
        handlers.ContentChangedHandler = null;
        handlers.IsAttached = false;
    }

    private static void FadeInOnContentChange(ContentControl host, HandlerSet handlers)
    {
        // Respect user preference when Windows animations are disabled.
        if (!SystemParameters.ClientAreaAnimation)
        {
            return;
        }

        if (!host.IsLoaded || !host.IsVisible)
        {
            return;
        }

        if (host.Content == null)
        {
            return;
        }

        // Cancel any in-flight animation to avoid stacking.
        try { host.BeginAnimation(UIElement.OpacityProperty, null); } catch { /* ignore */ }

        // Versioning prevents older completion callbacks from restoring the opacity mid-transition.
        var version = unchecked(++handlers.Version);
        host.Opacity = 0;

        var anim = new DoubleAnimation
        {
            From = 0,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(120),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut },
            FillBehavior = FillBehavior.Stop
        };
        anim.Completed += (_, __) =>
        {
            if (!ReferenceEquals(host, null) && handlers.Version == version)
            {
                host.Opacity = 1;
            }
        };

        try
        {
            host.BeginAnimation(UIElement.OpacityProperty, anim, HandoffBehavior.SnapshotAndReplace);
        }
        catch
        {
            host.Opacity = 1;
        }
    }
}
