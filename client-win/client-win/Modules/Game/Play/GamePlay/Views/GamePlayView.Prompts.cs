using System;
using System.ComponentModel;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private GamePlayViewModel? _promptVm;
    private PropertyChangedEventHandler? _promptVmChanged;

    private void HookInlinePromptAutoFocus(GamePlayViewModel? vm)
    {
        if (_promptVm != null && _promptVmChanged != null)
        {
            _promptVm.PropertyChanged -= _promptVmChanged;
        }

        _promptVm = vm;
        _promptVmChanged = null;

        if (_promptVm == null)
        {
            return;
        }

        _promptVmChanged = (_, e) =>
        {
            if (string.Equals(e.PropertyName, nameof(GamePlayViewModel.HasInlinePrompt), StringComparison.Ordinal))
            {
                if (_promptVm.HasInlinePrompt)
                {
                    _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstInlinePromptField));
                }
                else
                {
                    _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusPreferredInteractiveElement));
                }
            }

            if (string.Equals(e.PropertyName, nameof(GamePlayViewModel.HasPendingConfigPrompt), StringComparison.Ordinal) &&
                _promptVm.HasPendingConfigPrompt)
            {
                _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstInlinePromptField));
            }

            if (string.Equals(e.PropertyName, nameof(GamePlayViewModel.HasPendingTextPrompt), StringComparison.Ordinal) &&
                _promptVm.HasPendingTextPrompt)
            {
                _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstInlinePromptField));
            }
        };

        _promptVm.PropertyChanged += _promptVmChanged;

        if (_promptVm.HasInlinePrompt)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstInlinePromptField));
        }

        if (_promptVm.HasPendingConfigPrompt)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstInlinePromptField));
        }

        if (_promptVm.HasPendingTextPrompt)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstInlinePromptField));
        }
    }

    private void FocusFirstInlinePromptField()
    {
        try
        {
            if (InlinePromptOverlay == null || InlinePromptOverlay.Visibility != Visibility.Visible)
            {
                return;
            }

            var requestId = ++_inlinePromptFocusRequestId;
            Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
            {
                TryFocusFirstInlinePromptFieldWithRetry(requestId, remainingAttempts: 8);
            }));
        }
        catch
        {
            // best-effort
        }
    }

    private void TryFocusFirstInlinePromptFieldWithRetry(int requestId, int remainingAttempts)
    {
        if (requestId != _inlinePromptFocusRequestId)
        {
            return;
        }

        if (InlinePromptOverlay == null || InlinePromptOverlay.Visibility != Visibility.Visible)
        {
            return;
        }

        if (FindFirstFocusable(InlinePromptOverlay) is IInputElement el)
        {
            Keyboard.Focus(el);
            (el as UIElement)?.Focus();
            return;
        }

        if (remainingAttempts <= 0)
        {
            InlinePromptOverlay.Focus();
            Keyboard.Focus(InlinePromptOverlay);
            return;
        }

        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            TryFocusFirstInlinePromptFieldWithRetry(requestId, remainingAttempts - 1);
        }));
    }

    private static DependencyObject? FindFirstFocusable(DependencyObject root)
    {
        if (root is Control c && c.IsVisible && c.IsEnabled && (c.Focusable || KeyboardNavigation.GetIsTabStop(c)))
        {
            return c;
        }

        if (root is UIElement u && u.IsVisible && u.IsEnabled && u.Focusable)
        {
            return u;
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child == null) continue;
            var found = FindFirstFocusable(child);
            if (found != null) return found;
        }

        return null;
    }

    private async void OnInlinePromptSubmitClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }

        try
        {
            await vm.SubmitInlinePromptAsync(CancellationToken.None).ConfigureAwait(true);
        }
        catch
        {
            // ignore
        }
        finally
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusPreferredInteractiveElement));
        }
    }

    private async void OnInlinePromptCancelClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }

        try
        {
            await vm.CancelInlinePromptAsync(CancellationToken.None).ConfigureAwait(true);
        }
        catch
        {
            // ignore
        }
        finally
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusPreferredInteractiveElement));
        }
    }



    private void CycleInlinePromptFocus(bool backwards)
    {
        try
        {
            if (InlinePromptOverlay == null || InlinePromptOverlay.Visibility != Visibility.Visible)
            {
                return;
            }

            var focusables = new System.Collections.Generic.List<Control>();
            CollectFocusableControls(InlinePromptOverlay, focusables);
            if (focusables.Count == 0)
            {
                FocusFirstInlinePromptField();
                return;
            }

            var current = Keyboard.FocusedElement as DependencyObject;
            var currentControl = FindAncestorControl(current);
            var idx = currentControl != null ? focusables.IndexOf(currentControl) : -1;

            var nextIdx = backwards
                ? (idx <= 0 ? focusables.Count - 1 : idx - 1)
                : (idx < 0 || idx >= focusables.Count - 1 ? 0 : idx + 1);

            var target = focusables[nextIdx];
            target.Focus();
            Keyboard.Focus(target);
        }
        catch
        {
            // best-effort
        }
    }

    private static void CollectFocusableControls(
        DependencyObject root,
        System.Collections.Generic.ICollection<Control> outList)
    {
        if (root is Control c && c.IsVisible && c.IsEnabled && KeyboardNavigation.GetIsTabStop(c))
        {
            outList.Add(c);
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child == null) continue;
            CollectFocusableControls(child, outList);
        }
    }

    private static Control? FindAncestorControl(DependencyObject? el)
    {
        var cur = el;
        while (cur != null)
        {
            if (cur is Control c)
            {
                return c;
            }
            cur = VisualTreeHelper.GetParent(cur);
        }
        return null;
    }

    private async void OnInlinePromptPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not GamePlayViewModel vm || !vm.HasInlinePrompt)
        {
            return;
        }

        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            try
            {
                await vm.CancelInlinePromptAsync(CancellationToken.None).ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
            return;
        }

        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            var backwards = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
            CycleInlinePromptFocus(backwards);
            return;
        }

        if (e.Key is Key.Enter or Key.Return)
        {
            e.Handled = true;
            try
            {
                await vm.SubmitInlinePromptAsync(CancellationToken.None).ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
        }
    }
}
