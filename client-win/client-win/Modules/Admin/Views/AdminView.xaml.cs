using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using client_win.Modules.Admin.ViewModels;

namespace client_win.Modules.Admin.Views;

public partial class AdminView : UserControl
{
    private AdminViewModel? _vm;

    public AdminView()
    {
        InitializeComponent();
        DataContextChanged += (_, __) => AttachViewModel(DataContext as AdminViewModel);
        Unloaded += (_, __) => AttachViewModel(null);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as AdminViewModel);
        FocusWhenContainersGenerated();
        FocusBestInputIfVisible();
    }

    private void AttachViewModel(AdminViewModel? vm)
    {
        if (_vm == vm)
        {
            return;
        }

        if (_vm != null)
        {
            _vm.NavigationChanged -= OnNavigationChanged;
        }

        _vm = vm;
        if (_vm != null)
        {
            _vm.NavigationChanged += OnNavigationChanged;
        }
    }

    private void OnNavigationChanged()
    {
        FocusWhenContainersGenerated();
        FocusBestInputIfVisible();
    }

    private void FocusBestInputIfVisible()
    {
        if (DataContext is not AdminViewModel vm)
        {
            return;
        }
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (vm.IsTextInputVisible)
            {
                InputsView?.PrimaryInputBox?.Focus();
                return;
            }
            if (vm.IsSecondaryInputVisible)
            {
                InputsView?.SecondaryInputTextBox?.Focus();
            }
        }));
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
            // La sélection VM peut arriver avant que WPF n'ait propagé SelectedIndex.
            // Dans ce cas, retrouver l'index depuis SelectedItem côté VM pour éviter de repartir au début.
            if (DataContext is AdminViewModel vm && vm.SelectedItem != null)
            {
                var idx = ItemsList.Items.IndexOf(vm.SelectedItem);
                if (idx >= 0)
                {
                    ItemsList.SelectedIndex = idx;
                }
            }

            if (ItemsList.SelectedIndex < 0)
            {
                ItemsList.SelectedIndex = 0;
            }
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
