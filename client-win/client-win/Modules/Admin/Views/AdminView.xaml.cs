using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
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
        AttachItemsKeyNavigation();
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

    private void AttachItemsKeyNavigation()
    {
        if (ItemsList == null)
        {
            return;
        }

        ItemsList.PreviewKeyDown -= OnItemsListPreviewKeyDown;
        ItemsList.PreviewKeyDown += OnItemsListPreviewKeyDown;
    }

    private void OnItemsListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.Key != Key.Tab)
        {
            return;
        }

        if (DataContext is not AdminViewModel vm)
        {
            return;
        }

        if (!vm.IsTextInputVisible && !vm.IsSecondaryInputVisible)
        {
            return;
        }

        // When a form is visible, allow Tab/Shift+Tab from the actions list to jump back to inputs.
        // This avoids getting "stuck" on the Validate item.
        var wantSecondaryFirst = Keyboard.Modifiers.HasFlag(ModifierKeys.Shift);
        if (wantSecondaryFirst && vm.IsSecondaryInputVisible)
        {
            InputsView?.SecondaryInputTextBox?.Focus();
            e.Handled = true;
            return;
        }

        if (vm.IsTextInputVisible)
        {
            InputsView?.PrimaryInputBox?.Focus();
            e.Handled = true;
            return;
        }

        if (vm.IsSecondaryInputVisible)
        {
            InputsView?.SecondaryInputTextBox?.Focus();
            e.Handled = true;
        }
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

        var viewModel = DataContext as AdminViewModel;

        // Aligner la sélection WPF avec la sélection VM pour éviter de "repartir au début"
        // lors des retours (Échap) où SelectedIndex peut être temporairement incohérent.
        if (viewModel?.SelectedItem != null)
        {
            var desiredIndex = ItemsList.Items.IndexOf(viewModel.SelectedItem);
            if (desiredIndex >= 0 && desiredIndex != ItemsList.SelectedIndex)
            {
                ItemsList.SelectedIndex = desiredIndex;
            }
        }

        if (ItemsList.SelectedIndex < 0)
        {
            // La sélection VM peut arriver avant que WPF n'ait propagé SelectedIndex.
            // Dans ce cas, retrouver l'index depuis SelectedItem côté VM pour éviter de repartir au début.
            if (viewModel?.SelectedItem != null)
            {
                var idx = ItemsList.Items.IndexOf(viewModel.SelectedItem);
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
