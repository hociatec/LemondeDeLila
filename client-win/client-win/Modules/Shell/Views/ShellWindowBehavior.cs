using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Input;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.ViewModels;

namespace client_win.Modules.Shell.Views;

public static class ShellWindowBehavior
{
    public static readonly DependencyProperty EnableProperty =
        DependencyProperty.RegisterAttached(
            "Enable",
            typeof(bool),
            typeof(ShellWindowBehavior),
            new PropertyMetadata(false, OnEnableChanged));

    private sealed class HandlerSet
    {
        public RoutedEventHandler? Loaded { get; init; }
        public CancelEventHandler? Closing { get; init; }
        public KeyEventHandler? PreviewKeyDown { get; init; }
        public MouseButtonEventHandler? PreviewMouseDown { get; init; }
        public EventHandler? Activated { get; init; }
        public EventHandler? Closed { get; init; }
        public IDisposable? FocusSafety { get; init; }
    }

    private static readonly ConditionalWeakTable<Window, HandlerSet> HandlersByWindow = new();

    public static void SetEnable(DependencyObject element, bool value) =>
        element.SetValue(EnableProperty, value);

    public static bool GetEnable(DependencyObject element) =>
        (bool)element.GetValue(EnableProperty);

    private static void OnEnableChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not Window window)
        {
            return;
        }

        var enabled = e.NewValue is true;
        if (enabled)
        {
            Attach(window);
        }
        else
        {
            Detach(window);
        }
    }

    private static void Attach(Window window)
    {
        Detach(window);

        IDisposable? focusSafety = null;
        try
        {
            focusSafety = new ShellFocusSafetyCoordinator(window);
        }
        catch
        {
            // best-effort
        }

        RoutedEventHandler loaded = async (_, _) =>
        {
            if (window.DataContext is ShellViewModel vm)
            {
                await vm.OnLoadedAsync().ConfigureAwait(true);
            }
        };

        CancelEventHandler closing = (_, args) =>
        {
            if (window.DataContext is ShellViewModel vm)
            {
                vm.OnClosing(args);
            }
        };

        KeyEventHandler previewKeyDown = (_, args) =>
        {
            if (window.DataContext is ShellViewModel vm)
            {
                vm.OnPreviewKeyDown(window, args);
            }
        };

        MouseButtonEventHandler previewMouseDown = (_, args) =>
        {
            if (window.DataContext is ShellViewModel vm)
            {
                vm.OnPreviewMouseDown(args);
            }
        };

        EventHandler activated = (_, _) =>
        {
            if (window.DataContext is ShellViewModel vm)
            {
                vm.OnActivated();
            }
        };

        EventHandler closed = async (_, _) =>
        {
            if (window.DataContext is ShellViewModel vm)
            {
                await vm.OnClosedAsync().ConfigureAwait(false);
            }
        };

        window.Loaded += loaded;
        window.Closing += closing;
        window.PreviewKeyDown += previewKeyDown;
        window.PreviewMouseDown += previewMouseDown;
        window.Activated += activated;
        window.Closed += closed;

        HandlersByWindow.Add(window, new HandlerSet
        {
            Loaded = loaded,
            Closing = closing,
            PreviewKeyDown = previewKeyDown,
            PreviewMouseDown = previewMouseDown,
            Activated = activated,
            Closed = closed,
            FocusSafety = focusSafety,
        });
    }

    private static void Detach(Window window)
    {
        if (!HandlersByWindow.TryGetValue(window, out var handlers))
        {
            return;
        }

        if (handlers.Loaded != null) window.Loaded -= handlers.Loaded;
        if (handlers.Closing != null) window.Closing -= handlers.Closing;
        if (handlers.PreviewKeyDown != null) window.PreviewKeyDown -= handlers.PreviewKeyDown;
        if (handlers.PreviewMouseDown != null) window.PreviewMouseDown -= handlers.PreviewMouseDown;
        if (handlers.Activated != null) window.Activated -= handlers.Activated;
        if (handlers.Closed != null) window.Closed -= handlers.Closed;

        try { handlers.FocusSafety?.Dispose(); } catch { /* ignore */ }

        HandlersByWindow.Remove(window);
    }
}
