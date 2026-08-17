using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.Shell.ViewModels;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView
{
    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        _focusPolicy?.NotifyUserKeyDown(key);

        if (key is Key.Enter or Key.Return)
        {
            if (DataContext is GameRoomViewModel vm &&
                vm.GameZone is { IsStarted: false } &&
                vm.GameZone.StartCommand.CanExecute(null))
            {
                var focused = Keyboard.FocusedElement as DependencyObject ?? e.OriginalSource as DependencyObject;

                if (ChatInput != null &&
                    (ChatInput.IsKeyboardFocusWithin ||
                     ReferenceEquals(Keyboard.FocusedElement, ChatInput) ||
                     (focused != null && GameRoomViewFocusTree.IsFocusWithinElement(ChatInput, focused))))
                {
                    return;
                }

                if (HasVisibleInlinePrompt())
                {
                    return;
                }

                e.Handled = true;
                vm.GameZone.StartCommand.Execute(null);
                return;
            }
        }

        if (key == Key.Tab)
        {
            var isShift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
            if (TryHandleTabCycle(isShift, e.OriginalSource as DependencyObject))
            {
                e.Handled = true;
                return;
            }
        }
    }

    private void OnChatInputPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var key = e.Key == Key.System ? e.SystemKey : e.Key;

        if (key is not (Key.Enter or Key.Return))
        {
            return;
        }

        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        if (vm.Chat.SendCommand.CanExecute(null))
        {
            e.Handled = true;
            vm.Chat.SendCommand.Execute(null);
        }
    }

    private void HookRootTabCapture(bool attach)
    {
        if (Root == null)
        {
            return;
        }

        if (_rootTabHandler != null)
        {
            Root.RemoveHandler(Keyboard.PreviewKeyDownEvent, _rootTabHandler);
            _rootTabHandler = null;
        }

        if (!attach)
        {
            return;
        }

        _rootTabHandler = OnPreviewKeyDown;
        Root.AddHandler(Keyboard.PreviewKeyDownEvent, _rootTabHandler, handledEventsToo: true);
    }

    private void QueueAction(DispatcherPriority priority, Action action)
    {
        _ = Dispatcher.BeginInvoke(priority, action);
    }

    private static bool TryFocusElement(IInputElement element)
    {
        var focused = false;
        try
        {
            focused = element.Focus();
        }
        catch
        {
            // ignore
        }

        try
        {
            Keyboard.Focus(element);
        }
        catch
        {
            // ignore
        }

        return focused;
    }
}
