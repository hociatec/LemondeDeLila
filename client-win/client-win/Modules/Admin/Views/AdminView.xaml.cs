using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
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

    private void EnsureRootAccordionExpandedGroupCore()
    {
        if (ItemsList == null)
        {
            return;
        }

        if (DataContext is not AdminViewModel vm || !vm.IsRootMenu)
        {
            return;
        }

        // À l'arrivée dans l'admin (menu racine), on veut voir uniquement les 4 catégories repliées.
        // L'utilisateur développe une catégorie pour voir son contenu.
        CollapseAllGroups();

        var desiredCategory = vm.SelectedItem?.Category ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(desiredCategory))
        {
            FocusGroupHeader(desiredCategory);
        }
    }

    private void OnGroupExpanderExpanded(object sender, RoutedEventArgs e)
    {
        if (sender is not Expander expanded || ItemsList == null)
        {
            return;
        }

        if (expanded.DataContext is not CollectionViewGroup group)
        {
            return;
        }

        var category = group.Name?.ToString();
        CollapseOtherGroups(expanded);

        if (DataContext is not AdminViewModel vm || !vm.IsRootMenu)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(category))
        {
            return;
        }

        if (vm.SelectedItem?.Category == category)
        {
            return;
        }

        var firstItemInGroup = vm.Items.FirstOrDefault(x => string.Equals(x.Category, category, StringComparison.Ordinal));
        if (firstItemInGroup == null)
        {
            return;
        }

        vm.SelectedItem = firstItemInGroup;
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
    }

    private void CollapseOtherGroups(Expander expanded)
    {
        if (ItemsList == null)
        {
            return;
        }

        foreach (var expander in FindVisualChildren<Expander>(ItemsList))
        {
            if (expander.DataContext is not CollectionViewGroup)
            {
                continue;
            }

            if (ReferenceEquals(expander, expanded))
            {
                continue;
            }

            expander.IsExpanded = false;
        }
    }

    private void CollapseAllGroups()
    {
        if (ItemsList == null)
        {
            return;
        }

        foreach (var expander in FindVisualChildren<Expander>(ItemsList))
        {
            if (expander.DataContext is not CollectionViewGroup)
            {
                continue;
            }

            expander.IsExpanded = false;
        }
    }

    private void FocusGroupHeader(string category)
    {
        if (ItemsList == null)
        {
            return;
        }

        Expander? match = null;
        Expander? first = null;

        foreach (var expander in FindVisualChildren<Expander>(ItemsList))
        {
            if (expander.DataContext is not CollectionViewGroup group)
            {
                continue;
            }

            first ??= expander;

            var groupName = group.Name?.ToString() ?? string.Empty;
            if (string.Equals(groupName, category, StringComparison.Ordinal))
            {
                match = expander;
                break;
            }
        }

        (match ?? first)?.Focus();
    }

    private void ExpandOnlyGroup(string category)
    {
        if (ItemsList == null)
        {
            return;
        }

        foreach (var expander in FindVisualChildren<Expander>(ItemsList))
        {
            if (expander.DataContext is not CollectionViewGroup group)
            {
                continue;
            }

            var groupName = group.Name?.ToString() ?? string.Empty;
            expander.IsExpanded = string.Equals(groupName, category, StringComparison.Ordinal);
        }
    }

    private static IEnumerable<T> FindVisualChildren<T>(DependencyObject root) where T : DependencyObject
    {
        if (root == null)
        {
            yield break;
        }

        var childrenCount = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < childrenCount; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child is T typed)
            {
                yield return typed;
            }

            foreach (var descendant in FindVisualChildren<T>(child))
            {
                yield return descendant;
            }
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

    private void FocusDetailsIfPreferred()
    {
        if (DataContext is not AdminViewModel vm)
        {
            return;
        }
        if (!vm.PreferDetailsFocus)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (DetailsBox == null)
            {
                return;
            }
            DetailsBox.Focus();
            DetailsBox.CaretIndex = 0;
            DetailsBox.ScrollToHome();
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                EnsureRootAccordionExpandedGroupCore();
                if (DataContext is AdminViewModel vm && vm.IsRootMenu)
                {
                    // Menu racine : focus sur l'en-tête de catégorie (accordéon replié).
                    FocusGroupHeader(vm.SelectedItem?.Category ?? string.Empty);
                }
                else
                {
                    FocusFirstItem();
                }
            }));
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                EnsureRootAccordionExpandedGroupCore();
                if (DataContext is AdminViewModel vm && vm.IsRootMenu)
                {
                    FocusGroupHeader(vm.SelectedItem?.Category ?? string.Empty);
                }
                else
                {
                    FocusFirstItem();
                }
            }));
        };
        ItemsList.ItemContainerGenerator.StatusChanged += handler;
    }
}
