using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Admin.ViewModels;

namespace client_win.Modules.Admin.Views;

public partial class AdminView : UserControl
{
    public AdminView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        FocusWhenContainersGenerated();
        FocusPrimaryInputIfVisible();
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape && DataContext is AdminViewModel vm)
        {
            e.Handled = true;
            var result = vm.HandleEscape();
            if (result != AdminNavResult.Closed)
            {
                FocusWhenContainersGenerated();
                FocusPrimaryInputIfVisible();
            }
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not AdminViewModel vm)
        {
            return;
        }
        e.Handled = true;
        await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
        FocusWhenContainersGenerated();
        FocusPrimaryInputIfVisible();
    }

    private void OnListKeyDown(object sender, KeyEventArgs e)
    {
        // EmpÃªche Tab de sortir de la zone principale lorsque l'utilisateur est dans les listes.
        if ((e.Key == Key.Tab || e.Key == Key.System) &&
            DataContext is AdminViewModel vm &&
            !vm.IsTextInputVisible)
        {
            e.Handled = true;
        }
    }

    private async void OnInputKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not AdminViewModel vm)
        {
            return;
        }
        e.Handled = true;
        await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
        FocusWhenContainersGenerated();
        FocusPrimaryInputIfVisible();
    }

    private async void OnCheckItemClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not AdminViewModel vm)
        {
            return;
        }
        if (sender is not FrameworkElement fe || fe.DataContext is not AdminMenuItem clicked)
        {
            return;
        }

        e.Handled = true;
        vm.SelectedItem = clicked;
        await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
        FocusWhenContainersGenerated();
        FocusPrimaryInputIfVisible();
    }

    private void FocusPrimaryInputIfVisible()
    {
        if (DataContext is not AdminViewModel vm)
        {
            return;
        }
        if (!vm.IsTextInputVisible)
        {
            return;
        }
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() => PrimaryInput?.Focus()));
    }

    private void FocusFirstItem()
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            ItemsList?.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        ItemsList.UpdateLayout();
        if (ItemsList.ItemContainerGenerator.ContainerFromIndex(ItemsList.SelectedIndex) is ListBoxItem item)
        {
            item.Focus();
        }
        else
        {
            ItemsList.Focus();
        }
    }

    private void FocusWhenContainersGenerated()
    {
        if (ItemsList == null)
        {
            return;
        }

        if (ItemsList.HasItems &&
            ItemsList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
            return;
        }

        EventHandler? handler = null;
        handler = (_, __) =>
        {
            if (ItemsList.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
            {
                return;
            }

            ItemsList.ItemContainerGenerator.StatusChanged -= handler;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
        };
        ItemsList.ItemContainerGenerator.StatusChanged += handler;
    }
}
