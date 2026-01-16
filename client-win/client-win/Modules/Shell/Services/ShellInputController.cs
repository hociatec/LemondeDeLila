using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Presence.Views;
using client_win.Modules.Game.Shell.Views;

namespace client_win.Modules.Shell.Services;

public sealed class ShellInputController
{
    private readonly IPresenceMonitor _presence;
    private readonly IPresenceLauncher _presenceUi;
    private readonly INavigationService _navigation;
    private readonly IMenuRouter _menuRouter;

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
            if (_navigation.CurrentView is PresenceView)
            {
                return;
            }
            _ = _presenceUi.OpenAsync(window);
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
            if (_navigation.CurrentView is GameRoomView room)
            {
                Application.Current?.Dispatcher?.BeginInvoke(DispatcherPriority.Input, new Action(room.RequestFocusGameZone));
            }
        }
        catch
        {
            // ignore
        }
    }
}

