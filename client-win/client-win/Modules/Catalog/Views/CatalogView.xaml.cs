using System.Windows;
using System.Windows.Controls;
using client_win.Modules.Catalog.ViewModels;
using System.Windows.Threading;
using System.Windows.Input;
using System;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Catalog.Views;

public partial class CatalogView : UserControl, IInitialFocusTarget
{
    public CatalogView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        // À l'entrée dans la taverne, le focus doit être sur la liste principale (actions + catégories).
        Dispatcher.BeginInvoke(DispatcherPriority.Input, () => FocusWhenContainersGenerated(CategoriesList));
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
            var inCategoriesColumn = CategoriesList?.IsKeyboardFocusWithin == true;
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

    private void OnCategoriesKeyDown(object sender, KeyEventArgs e)
    {
        if ((e.Key != Key.Enter && e.Key != Key.Return) || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        if (vm.TryActivateSelectedShelfAction())
        {
            e.Handled = true;
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

    public void RequestInitialFocus()
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            FocusWhenContainersGenerated(CategoriesList);
        }));
    }
}
