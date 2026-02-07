using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Shell.Views;
using client_win.Modules.Vault.ViewModels;

namespace client_win.Modules.Vault.Views;

public partial class VaultView : UserControl, IInitialFocusTarget
{
    public VaultView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
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

    public void RequestInitialFocus()
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            try
            {
                if (ItemsList?.HasItems == true)
                {
                    var targetIndex = ItemsList.SelectedIndex >= 0 ? ItemsList.SelectedIndex : 0;
                    ItemsList.SelectedIndex = targetIndex;
                    if (TryFocusSavedTable(targetIndex))
                    {
                        return;
                    }
                    ItemsList.Focus();
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
        ItemsList.ScrollIntoView(ItemsList.Items[safeIndex]);
        ItemsList.UpdateLayout();
        var container = ItemsList.ItemContainerGenerator.ContainerFromIndex(safeIndex) as ListBoxItem;
        if (container == null)
        {
            ItemsList.UpdateLayout();
            container = ItemsList.ItemContainerGenerator.ContainerFromIndex(safeIndex) as ListBoxItem;
        }

        if (container != null)
        {
            container.Focus();
            return true;
        }

        return false;
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not VaultViewModel vm)
        {
            return;
        }

        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            if (vm.CloseCommand.CanExecute(null))
            {
                vm.CloseCommand.Execute(null);
            }
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
}
