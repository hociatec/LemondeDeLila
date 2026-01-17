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
            if (!string.Equals(e.PropertyName, nameof(GamePlayViewModel.HasInlinePrompt), StringComparison.Ordinal))
            {
                return;
            }

            if (_promptVm.HasInlinePrompt)
            {
                _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstInlinePromptField));
            }
            else
            {
                _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(ForceFocusGameZone));
            }
        };

        _promptVm.PropertyChanged += _promptVmChanged;

        if (_promptVm.HasInlinePrompt)
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

            InlinePromptOverlay.UpdateLayout();

            if (FindFirstFocusable(InlinePromptOverlay) is IInputElement el)
            {
                Keyboard.Focus(el);
                (el as UIElement)?.Focus();
            }
        }
        catch
        {
            // best-effort
        }
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(ForceFocusGameZone));
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(ForceFocusGameZone));
        }
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
