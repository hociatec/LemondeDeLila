using System;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Presence.Views;
using client_win.Modules.Presence.ViewModels;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Shell.Services;

public sealed class ShellInputController
{
    private readonly IPresenceMonitor _presence;
    private readonly IPresenceLauncher _presenceUi;
    private readonly INavigationService _navigation;
    private readonly IMenuRouter _menuRouter;
    private int _didInitialActivationFocus;

    public ShellInputController(
        IPresenceMonitor presence,
        IPresenceLauncher presenceUi,
        INavigationService navigation,
        IMenuRouter menuRouter)
    {
        _presence = presence ?? throw new ArgumentNullException(nameof(presence));
        _presenceUi = presenceUi ?? throw new ArgumentNullException(nameof(presenceUi));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _menuRouter = menuRouter ?? throw new ArgumentNullException(nameof(menuRouter));
    }

    public void OnPreviewKeyDown(Window window, KeyEventArgs e)
    {
        if (e == null) throw new ArgumentNullException(nameof(e));

        try
        {
            var interactionKey = e.Key == Key.System ? e.SystemKey : e.Key;
            if (interactionKey is not (Key.LeftShift or Key.RightShift or Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin))
            {
                _ = _presence.NotifyUserInteractionAsync();
            }
        }
        catch
        {
            // ignore
        }

        var isAlt = (Keyboard.Modifiers & ModifierKeys.Alt) == ModifierKeys.Alt;
        var isCtrl = (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control;
        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (isAlt && key == Key.F4)
        {
            e.Handled = true;
            window?.Close();
            return;
        }

        if (key == Key.F3)
        {
            e.Handled = true;
            _ = Application.Current?.Dispatcher?.BeginInvoke(DispatcherPriority.Input, new Action(async () =>
            {
                try
                {
                    await _menuRouter.OpenContactAdmin().ConfigureAwait(true);
                }
                catch
                {
                    // ignore
                }
            }));
            return;
        }

        if (isCtrl && key == Key.U)
        {
            e.Handled = true;
            if (_navigation.CurrentContent is PresenceViewModel or PresenceView)
            {
                return;
            }

            var owner = window;
            _ = owner.Dispatcher.BeginInvoke(
                DispatcherPriority.Background,
                new Action(async () =>
                {
                    try
                    {
                        await _presenceUi.OpenAsync(owner).ConfigureAwait(true);
                    }
                    catch
                    {
                        // ignore
                    }
                }));
        }
    }

    public void OnPreviewMouseDown(MouseButtonEventArgs e)
    {
        try
        {
            _ = _presence.NotifyUserInteractionAsync();
        }
        catch
        {
            // ignore
        }
    }

    public void OnActivated()
    {
        try
        {
            if (_navigation.CurrentContent is GameRoomView room)
            {
                Application.Current?.Dispatcher?.BeginInvoke(DispatcherPriority.Input, new Action(room.RequestFocusGameZone));
                return;
            }

            var window = Application.Current?.MainWindow;
            if (window == null)
            {
                return;
            }

            var root = TryGetContentRoot(window);
            if (root is IInitialFocusTarget focusTarget)
            {
                if (Interlocked.Exchange(ref _didInitialActivationFocus, 1) == 1)
                {
                    return;
                }

                void Request()
                {
                    try { focusTarget.RequestInitialFocus(); } catch { }
                }

                window.Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(Request));
                window.Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(Request));
            }
        }
        catch
        {
            // ignore
        }
    }

    private static DependencyObject? TryGetContentRoot(Window window)
    {
        try
        {
            var rootHost = window.FindName("RootHost");
            if (rootHost is Views.StableContentHost stable)
            {
                return stable.TryGetCurrentContentRoot();
            }

            if (rootHost is not ContentControl host)
            {
                return null;
            }

            if (host.Content is DependencyObject direct && PresentationSource.FromDependencyObject(direct) != null)
            {
                return direct;
            }

            if (FindDescendant<ContentPresenter>(host) is ContentPresenter presenter)
            {
                var children = VisualTreeHelper.GetChildrenCount(presenter);
                if (children > 0)
                {
                    return VisualTreeHelper.GetChild(presenter, 0);
                }
            }

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
}
