using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.MainMenu.ViewModels;

namespace client_win.Modules.MainMenu.Views;

public partial class MainMenuView : UserControl
{
    public MainMenuView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        FocusWhenContainersGenerated();
        if (DataContext is MainMenuViewModel vm)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
            {
                await vm.RefreshAdminVisibilityCommand.ExecuteAsync(null).ConfigureAwait(true);
                FocusWhenContainersGenerated();
            }));
        }
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            MoveFocusByTab();
            return;
        }

        if (IsNavigationKey(e.Key))
        {
            e.Handled = true;
            return;
        }

        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not MainMenuViewModel vm)
        {
            return;
        }
        e.Handled = true;
        await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
        FocusWhenContainersGenerated();
    }

    private void MoveFocusByTab()
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            return;
        }

        int count = ItemsList.Items.Count;
        int currentIndex = ItemsList.SelectedIndex;
        if (currentIndex < 0)
        {
            currentIndex = 0;
        }

        bool backwards = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
        int nextIndex = backwards ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0)
        {
            nextIndex = count - 1;
        }
        else if (nextIndex >= count)
        {
            nextIndex = 0;
        }

        ItemsList.SelectedIndex = nextIndex;
        ItemsList.UpdateLayout();
        ItemsList.ScrollIntoView(ItemsList.SelectedItem);
        if (ItemsList.ItemContainerGenerator.ContainerFromIndex(nextIndex) is ListBoxItem item)
        {
            item.Focus();
            Keyboard.Focus(item);
        }
        else
        {
            ItemsList.Focus();
        }
    }

    private static bool IsNavigationKey(Key key)
    {
        return key == Key.Up ||
               key == Key.Down ||
               key == Key.Left ||
               key == Key.Right ||
               key == Key.Home ||
               key == Key.End ||
               key == Key.PageUp ||
               key == Key.PageDown;
    }

    private void OnListKeyDown(object sender, KeyEventArgs e)
    {
        // Empêche Tab de sortir de la zone principale lorsque l'utilisateur est dans la liste.
        if (e.Key == Key.Tab || e.Key == Key.System)
        {
            e.Handled = true;
        }
    }

    private void FocusFirstItem()
    {
        void FocusItemAtIndex(int index)
        {
            ItemsList.UpdateLayout();
            ItemsList.ScrollIntoView(ItemsList.SelectedItem);
            if (ItemsList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
            {
                item.Focus();
                Keyboard.Focus(item);
            }
            else
            {
                ItemsList.Focus();
            }
        }

        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            ItemsList?.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        FocusItemAtIndex(ItemsList.SelectedIndex);
    }

    private void OnListGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (ItemsList == null)
        {
            return;
        }

        // Si le focus arrive sur la liste elle-même, le remonter sur l'item sélectionné
        // pour que NVDA annonce directement l'entrée et pas juste "liste".
        if (ReferenceEquals(e.NewFocus, ItemsList))
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
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
