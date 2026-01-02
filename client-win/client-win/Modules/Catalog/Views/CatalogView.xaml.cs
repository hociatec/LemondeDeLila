using System.Windows;
using System.Windows.Controls;
using client_win.Modules.Catalog.ViewModels;
using System.Windows.Threading;
using System.Windows.Input;
using System;
using client_win.Modules.Catalog.Models;

namespace client_win.Modules.Catalog.Views;

public partial class CatalogView : UserControl
{
    public CatalogView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        // À l'entrée dans la taverne, le focus doit d'abord être sur les actions.
        Dispatcher.BeginInvoke(DispatcherPriority.Input, () => FocusWhenContainersGenerated(ActionsList));
    }

    private void OnKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key == System.Windows.Input.Key.Tab)
        {
            e.Handled = true;
            return;
        }
        if (e.Key == System.Windows.Input.Key.Escape && DataContext is CatalogViewModel vm)
        {
            var inCategoriesColumn = CategoriesList?.IsKeyboardFocusWithin == true || ActionsList?.IsKeyboardFocusWithin == true;
            var inSubCategoriesColumn = SubCategoriesList?.IsKeyboardFocusWithin == true;
            var result = vm.HandleEscape(inCategoriesColumn, inSubCategoriesColumn);
            e.Handled = true;
            // Repositionner le focus après navigation
            Dispatcher.BeginInvoke(DispatcherPriority.Input, () =>
            {
                FocusAfterEscape(result);
            });
        }
    }

    private void OnActionsKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key is Key.Enter or Key.Return)
        {
            if (ActionsList?.SelectedItem is CatalogViewModel.CatalogActionItem action &&
                action.Command?.CanExecute(null) == true)
            {
                e.Handled = true;
                action.Command.Execute(null);
            }
            return;
        }

        if (e.Key == Key.Down &&
            ActionsList != null &&
            CategoriesList != null &&
            ActionsList.SelectedIndex >= 0 &&
            ActionsList.SelectedIndex == ActionsList.Items.Count - 1)
        {
            e.Handled = true;
            FocusFirstItem(CategoriesList);
        }
    }

    private void OnCategoriesKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Up &&
            CategoriesList != null &&
            ActionsList != null &&
            ActionsList.Items.Count > 0 &&
            CategoriesList.SelectedIndex <= 0)
        {
            e.Handled = true;
            ActionsList.SelectedIndex = Math.Max(0, ActionsList.Items.Count - 1);
            ActionsList.UpdateLayout();
            if (ActionsList.ItemContainerGenerator.ContainerFromIndex(ActionsList.SelectedIndex) is ListBoxItem item)
            {
                item.Focus();
            }
            else
            {
                ActionsList.Focus();
            }
            return;
        }

        if ((e.Key != Key.Enter && e.Key != Key.Return) || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        // Force propagation vers sous-catégories ou jeux.
        if (SubCategoriesList?.HasItems == true)
        {
            SubCategoriesList.SelectedIndex = SubCategoriesList.SelectedIndex >= 0 ? SubCategoriesList.SelectedIndex : 0;
            vm.SelectedSubShelf = SubCategoriesList.SelectedItem as Modules.Catalog.Models.CatalogCategory;
            FocusFirstItem(SubCategoriesList);
        }
        else if (GamesList?.HasItems == true)
        {
            GamesList.SelectedIndex = GamesList.SelectedIndex >= 0 ? GamesList.SelectedIndex : 0;
            vm.SelectedGame = GamesList.SelectedItem as Modules.Catalog.Models.CatalogGame;
            FocusFirstItem(GamesList);
        }
        e.Handled = true;
    }

    private void OnSubCategoriesKeyDown(object sender, KeyEventArgs e)
    {
        if ((e.Key != Key.Enter && e.Key != Key.Return) || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        // Si la liste est vide (souvent après Esc), recharger puis attendre que WPF matérialise les conteneurs.
        if (GamesList?.HasItems != true && vm.SelectedSubShelf != null)
        {
            e.Handled = true;
            vm.ReloadGamesForCurrentSelection();
            FocusWhenContainersGenerated(GamesList);
            return;
        }

        if (GamesList?.HasItems == true)
        {
            GamesList.SelectedIndex = GamesList.SelectedIndex >= 0 ? GamesList.SelectedIndex : 0;
            vm.SelectedGame = GamesList.SelectedItem as Modules.Catalog.Models.CatalogGame;
            FocusFirstItem(GamesList);
            e.Handled = true;
        }
    }

    private async void OnGamesKeyDown(object sender, KeyEventArgs e)
    {
        if ((e.Key != Key.Enter && e.Key != Key.Return) || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        e.Handled = true;

        // Garantit que la sélection VM est à jour avant activation (évite un "Enter" qui ne fait rien).
        if (GamesList?.HasItems == true)
        {
            GamesList.SelectedIndex = GamesList.SelectedIndex >= 0 ? GamesList.SelectedIndex : 0;
            vm.SelectedGame = GamesList.SelectedItem as CatalogGame;
        }
        await vm.ActivateSelectedGameAsync().ConfigureAwait(true);
    }

    private async void OnGamesPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }

        if (DataContext is not CatalogViewModel vm)
        {
            return;
        }

        e.Handled = true;

        if (GamesList?.HasItems == true)
        {
            if (GamesList.SelectedIndex < 0)
            {
                GamesList.SelectedIndex = 0;
            }
            vm.SelectedGame = GamesList.SelectedItem as CatalogGame;
        }

        await vm.ActivateSelectedGameAsync().ConfigureAwait(true);
    }

    private async void OnGamesDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is not CatalogViewModel vm)
        {
            return;
        }

        // S'assure que l'item double-cliqué est bien sélectionné avant activation.
        if (GamesList != null && e.OriginalSource is DependencyObject source)
        {
            var container = ItemsControl.ContainerFromElement(GamesList, source) as ListBoxItem;
            if (container?.DataContext is CatalogGame clicked)
            {
                GamesList.SelectedItem = clicked;
                vm.SelectedGame = clicked;
            }
        }

        await vm.ActivateSelectedGameAsync().ConfigureAwait(true);
    }

    private void FocusAfterEscape(CatalogEscapeResult result)
    {
        switch (result)
        {
            case CatalogEscapeResult.ToSubCategory:
                FocusFirstItem(SubCategoriesList);
                break;
            case CatalogEscapeResult.ToCategory:
                FocusFirstItem(CategoriesList);
                break;
            case CatalogEscapeResult.Closed:
                return;
            default:
                FocusFirstItem(CategoriesList);
                break;
        }
    }

    private void FocusFirstItem(ListBox? listBox)
    {
        if (listBox == null || listBox.Items.Count == 0)
        {
            return;
        }

        if (listBox.SelectedIndex < 0)
        {
            listBox.SelectedIndex = 0;
        }

        listBox.UpdateLayout();
        if (listBox.ItemContainerGenerator.ContainerFromIndex(listBox.SelectedIndex) is ListBoxItem item)
        {
            item.Focus();
        }
        else
        {
            listBox.Focus();
        }
    }

    private void FocusWhenContainersGenerated(ListBox? listBox)
    {
        if (listBox == null)
        {
            return;
        }

        if (listBox.HasItems && listBox.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            FocusFirstItem(listBox);
            return;
        }

        EventHandler? handler = null;
        handler = (_, __) =>
        {
            if (listBox.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
            {
                return;
            }

            listBox.ItemContainerGenerator.StatusChanged -= handler;

            // Execute après la mise à jour de layout pour garantir ContainerFromIndex.
            Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
            {
                if (listBox.HasItems)
                {
                    FocusFirstItem(listBox);
                }
            }));
        };
        listBox.ItemContainerGenerator.StatusChanged += handler;
    }
}
