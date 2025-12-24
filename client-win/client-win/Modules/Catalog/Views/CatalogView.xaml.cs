using System.Windows;
using System.Windows.Controls;
using client_win.Modules.Catalog.ViewModels;
using System.Windows.Threading;
using System.Windows.Input;

namespace client_win.Modules.Catalog.Views;

public partial class CatalogView : UserControl
{
    public CatalogView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        CategoriesList.ItemContainerGenerator.StatusChanged += OnCategoriesContainersStatusChanged;
        Dispatcher.BeginInvoke(DispatcherPriority.Input, () =>
        {
            FocusFirstItem(CategoriesList);
        });
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
        if (e.Key != Key.Enter || DataContext is not CatalogViewModel vm)
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
        if (e.Key != Key.Enter || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        if (GamesList?.HasItems != true && vm.SelectedSubShelf != null)
        {
            vm.ReloadGamesForCurrentSelection();
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
        if (e.Key != Key.Enter || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        e.Handled = true;
        await vm.ActivateSelectedGameAsync().ConfigureAwait(true);
    }

    private async void OnGamesDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is not CatalogViewModel vm)
        {
            return;
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

    private void OnCategoriesContainersStatusChanged(object? sender, EventArgs e)
    {
        if (CategoriesList?.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            FocusFirstItem(CategoriesList);
            CategoriesList.ItemContainerGenerator.StatusChanged -= OnCategoriesContainersStatusChanged;
        }
    }
}
