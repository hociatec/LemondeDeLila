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
        AttachRootTabSuppression();
        AttachItemsKeyNavigation();
        FocusWhenContainersGenerated();
        FocusBestInputIfVisible();
        FocusDetailsIfPreferred();
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
            // Sécurité: si un aperçu de son est en cours, l'arrêter quand la vue admin se ferme.
            _vm.StopSoundPreview();
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
        FocusDetailsIfPreferred();
    }

    private void AttachRootTabSuppression()
    {
        PreviewKeyDown -= OnPreviewKeyDown;
        PreviewKeyDown += OnPreviewKeyDown;
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.Key != Key.Tab)
        {
            return;
        }

        if (DataContext is not AdminViewModel vm)
        {
            return;
        }

        if (vm.IsRootMenu)
        {
            // Dans le menu principal admin, éviter Tab/Maj+Tab qui déplace le focus hors de la liste.
            e.Handled = true;
        }
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

        if (vm.IsTextInputVisible)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => InputsView?.PrimaryInputBox?.Focus()));
            return;
        }

        if (vm.IsSecondaryInputVisible)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(() => InputsView?.SecondaryInputTextBox?.Focus()));
        }
    }

    private void FocusDetailsIfPreferred()
    {
        if (DataContext is not AdminViewModel vm || !vm.PreferDetailsFocus)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() => DetailsBox?.Focus()));
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedItem));
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedItem));
        };
        ItemsList.ItemContainerGenerator.StatusChanged += handler;
    }

    private void FocusSelectedItem()
    {
        if (ItemsList == null)
        {
            return;
        }

        if (ItemsList.Items.Count == 0)
        {
            ItemsList.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        var selected = ItemsList.SelectedItem;
        if (selected != null)
        {
            ItemsList.ScrollIntoView(selected);
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
}
