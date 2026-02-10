using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;
using client_win.Modules.Vault.ViewModels;

namespace client_win.Modules.Vault.Views;

public partial class VaultView : UserControl, IInitialFocusTarget
{
    private Window? _hostWindow;
    private int _focusRequestId;

    public VaultView()
    {
        InitializeComponent();
        IsVisibleChanged += OnIsVisibleChanged;
    }

    private void OnIsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (IsVisible != true)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            try
            {
                if (!IsVisible || IsKeyboardFocusWithin)
                {
                    return;
                }

                RequestInitialFocus();
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        HookWindowKeys();
        RequestInitialFocus();

        // Defer network calls until the view is visible (UI first).
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
        {
            try
            {
                if (DataContext is VaultViewModel vm)
                {
                    await vm.InitializeAsync().ConfigureAwait(true);
                    if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                    {
                        RequestInitialFocus();
                    }
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        UnhookWindowKeys();
    }

    public void RequestInitialFocus()
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            try
            {
                if (EmptyText?.IsVisible == true)
                {
                    EmptyText.Focus();
                    Keyboard.Focus(EmptyText);
                    return;
                }

                if (ItemsList?.HasItems == true)
                {
                    var targetIndex = ItemsList.SelectedIndex >= 0 ? ItemsList.SelectedIndex : 0;
                    ItemsList.SelectedIndex = targetIndex;
                    if (!TryFocusSavedTable(targetIndex))
                    {
                        ItemsList.Focus();
                    }
                    return;
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private bool TryFocusSavedTable(int index)
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            return false;
        }

        var safeIndex = Math.Max(0, Math.Min(index, ItemsList.Items.Count - 1));
        var requestId = unchecked(++_focusRequestId);
        FocusSavedTableWithRetry(requestId, safeIndex, attemptsRemaining: 8);
        return true;
    }

    private void FocusSavedTableWithRetry(int requestId, int index, int attemptsRemaining)
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            return;
        }

        var safeIndex = Math.Max(0, Math.Min(index, ItemsList.Items.Count - 1));
        ItemsList.ScrollIntoView(ItemsList.Items[safeIndex]);

        if (ItemsList.ItemContainerGenerator.ContainerFromIndex(safeIndex) is ListBoxItem container)
        {
            container.Focus();
            return;
        }

        if (attemptsRemaining > 0 && requestId == _focusRequestId)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Loaded,
                new Action(() => FocusSavedTableWithRetry(requestId, safeIndex, attemptsRemaining - 1)));
            return;
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not VaultViewModel vm)
        {
            return;
        }

        // Keep navigation inside the view (Tab can otherwise escape to the shell host).
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            return;
        }

        // When the list is empty, arrow keys can escape focus to the shell host depending on where focus is parked.
        // Swallow them so the user stays in the vault and Escape remains the way out.
        if (ItemsList?.HasItems != true &&
            e.Key is Key.Up or Key.Down or Key.Left or Key.Right or Key.Home or Key.End or Key.PageUp or Key.PageDown)
        {
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    if (vm.CloseCommand.CanExecute(null))
                    {
                        vm.CloseCommand.Execute(null);
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
            return;
        }

        if (e.Key == Key.Delete)
        {
            e.Handled = true;
            if (vm.DeleteCommand.CanExecute(null))
            {
                vm.DeleteCommand.Execute(null);
            }
            return;
        }

        if (e.Key is Key.Enter or Key.Return)
        {
            e.Handled = true;
            if (vm.RestoreCommand.CanExecute(null))
            {
                vm.RestoreCommand.Execute(null);
            }
        }
    }

    private void HookWindowKeys()
    {
        try
        {
            var window = Window.GetWindow(this);
            if (window == null || ReferenceEquals(_hostWindow, window))
            {
                return;
            }

            UnhookWindowKeys();
            _hostWindow = window;
            _hostWindow.PreviewKeyDown += OnWindowPreviewKeyDown;
        }
        catch
        {
            // best-effort
        }
    }

    private void UnhookWindowKeys()
    {
        try
        {
            if (_hostWindow != null)
            {
                _hostWindow.PreviewKeyDown -= OnWindowPreviewKeyDown;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _hostWindow = null;
        }
    }

    private void OnWindowPreviewKeyDown(object? sender, KeyEventArgs e)
    {
        if (!IsLoaded || !IsVisible)
        {
            return;
        }

        // Escape must work even if focus is temporarily parked on a stable shell element.
        if (e.Key == Key.Escape)
        {
            OnPreviewKeyDown(this, e);
            return;
        }

        // Other actions (Enter/Delete) must never fire unless the user is actually in the vault UI.
        if (!IsKeyboardFocusWithin)
        {
            return;
        }

        OnPreviewKeyDown(this, e);
    }
}
