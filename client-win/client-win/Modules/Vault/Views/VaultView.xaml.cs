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
    }

    public void RequestInitialFocus()
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            try
            {
                if (ItemsList?.HasItems == true)
                {
                    ItemsList.SelectedIndex = ItemsList.SelectedIndex >= 0 ? ItemsList.SelectedIndex : 0;
                }
                ItemsList?.Focus();
            }
            catch
            {
                // best-effort
            }
        }));
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

        if (e.Key == Key.F5)
        {
            e.Handled = true;
            if (vm.RefreshCommand.CanExecute(null))
            {
                vm.RefreshCommand.Execute(null);
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

