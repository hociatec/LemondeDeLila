using System;
using System.ComponentModel;
using System.Linq;
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
    private bool _inlinePromptDialogOpen;
    private string _lastInlinePromptDialogSignature = string.Empty;

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
                _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Func<System.Threading.Tasks.Task>(TryOpenConfigPromptDialogAsync));
            }

            if (string.Equals(e.PropertyName, nameof(GamePlayViewModel.HasPendingTextPrompt), StringComparison.Ordinal) &&
                _promptVm.HasPendingTextPrompt)
            {
                _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Func<System.Threading.Tasks.Task>(TryOpenTextPromptDialogAsync));
            }
        };

        _promptVm.PropertyChanged += _promptVmChanged;

        if (_promptVm.HasInlinePrompt)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstInlinePromptField));
        }

        if (_promptVm.HasPendingConfigPrompt)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Func<System.Threading.Tasks.Task>(TryOpenConfigPromptDialogAsync));
        }

        if (_promptVm.HasPendingTextPrompt)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Func<System.Threading.Tasks.Task>(TryOpenTextPromptDialogAsync));
        }
    }

    private async System.Threading.Tasks.Task TryOpenConfigPromptDialogAsync()
    {
        await TryOpenInlinePromptDialogAsync("config").ConfigureAwait(true);
    }

    private async System.Threading.Tasks.Task TryOpenTextPromptDialogAsync()
    {
        await TryOpenInlinePromptDialogAsync("text").ConfigureAwait(true);
    }

    private async System.Threading.Tasks.Task TryOpenInlinePromptDialogAsync(string mode)
    {
        if (_inlinePromptDialogOpen)
        {
            return;
        }

        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }

        var isConfigMode = string.Equals(mode, "config", StringComparison.OrdinalIgnoreCase);
        var isTextMode = string.Equals(mode, "text", StringComparison.OrdinalIgnoreCase);
        if (!isConfigMode && !isTextMode)
        {
            return;
        }

        var hasPendingTarget = isConfigMode ? vm.HasPendingConfigPrompt : vm.HasPendingTextPrompt;
        if (!hasPendingTarget || !vm.HasInlinePrompt || vm.InlinePromptFields.Count == 0)
        {
            return;
        }

        var signature = BuildInlinePromptSignature(vm, mode);
        if (string.Equals(signature, _lastInlinePromptDialogSignature, StringComparison.Ordinal))
        {
            return;
        }

        _inlinePromptDialogOpen = true;
        _lastInlinePromptDialogSignature = signature;
        try
        {
            while ((isConfigMode ? vm.HasPendingConfigPrompt : vm.HasPendingTextPrompt) && vm.HasInlinePrompt)
            {
                var result = ShowConfigPromptDialog(vm);
                if (result != true)
                {
                    await vm.CancelInlinePromptAsync(CancellationToken.None).ConfigureAwait(true);
                    break;
                }

                var submitted = await vm.SubmitInlinePromptAsync(CancellationToken.None).ConfigureAwait(true);
                if (submitted)
                {
                    break;
                }
            }
        }
        finally
        {
            _inlinePromptDialogOpen = false;
            if ((isConfigMode && !vm.HasPendingConfigPrompt) || (isTextMode && !vm.HasPendingTextPrompt))
            {
                _lastInlinePromptDialogSignature = string.Empty;
            }
        }
    }

    private static string BuildInlinePromptSignature(GamePlayViewModel vm, string mode)
    {
        var fields = string.Join(
            "|",
            vm.InlinePromptFields.Select(f =>
                $"{f.Key}:{f.Kind}:{f.Min?.ToString() ?? ""}:{f.Max?.ToString() ?? ""}:{f.Text}:{f.BoolValue}"));
        return $"{mode}|{vm.InlinePromptTitle}|{fields}";
    }

    private bool? ShowConfigPromptDialog(GamePlayViewModel vm)
    {
        var owner = Window.GetWindow(this) ?? Application.Current?.MainWindow;

        var window = new Window
        {
            Title = string.IsNullOrWhiteSpace(vm.InlinePromptTitle) ? "Configuration du jeu" : vm.InlinePromptTitle,
            Owner = owner,
            WindowStartupLocation = owner != null ? WindowStartupLocation.CenterOwner : WindowStartupLocation.CenterScreen,
            SizeToContent = SizeToContent.WidthAndHeight,
            MinWidth = 500,
            MinHeight = 260,
            ResizeMode = ResizeMode.NoResize,
            Background = new SolidColorBrush(Color.FromRgb(0x0B, 0x15, 0x23)),
            Foreground = Brushes.White
        };

        var panel = new StackPanel { Margin = new Thickness(20) };
        panel.Children.Add(new TextBlock
        {
            Text = window.Title,
            FontSize = 18,
            FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 12)
        });

        var firstInput = default(Control);
        foreach (var field in vm.InlinePromptFields)
        {
            panel.Children.Add(new TextBlock
            {
                Text = string.IsNullOrWhiteSpace(field.Label) ? field.Key : field.Label,
                Margin = new Thickness(0, 8, 0, 4)
            });

            if (field.IsBool)
            {
                var check = new CheckBox
                {
                    IsChecked = field.BoolValue,
                    Content = "Oui / Non",
                    Margin = new Thickness(0, 0, 0, 4)
                };
                check.Checked += (_, _) => field.BoolValue = true;
                check.Unchecked += (_, _) => field.BoolValue = false;
                panel.Children.Add(check);
                firstInput ??= check;
            }
            else
            {
                var box = new TextBox
                {
                    Text = field.Text ?? string.Empty,
                    MinWidth = 420,
                    Margin = new Thickness(0, 0, 0, 4)
                };
                box.TextChanged += (_, _) => field.Text = box.Text ?? string.Empty;
                panel.Children.Add(box);
                firstInput ??= box;
            }
        }

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 14, 0, 0)
        };

        var cancel = new Button { Content = "Annuler", Width = 120, Margin = new Thickness(0, 0, 8, 0) };
        cancel.Click += (_, _) =>
        {
            window.DialogResult = false;
            window.Close();
        };
        buttons.Children.Add(cancel);

        var submit = new Button { Content = "Valider", Width = 120, IsDefault = true };
        submit.Click += (_, _) =>
        {
            window.DialogResult = true;
            window.Close();
        };
        buttons.Children.Add(submit);

        panel.Children.Add(buttons);
        window.Content = panel;
        window.Loaded += (_, _) =>
        {
            if (firstInput != null)
            {
                firstInput.Focus();
                Keyboard.Focus(firstInput);
            }
        };

        return window.ShowDialog();
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
