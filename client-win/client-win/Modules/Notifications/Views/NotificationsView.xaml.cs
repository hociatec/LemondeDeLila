using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Notifications.ViewModels;

namespace client_win.Modules.Notifications.Views;

public partial class NotificationsView : UserControl
{
    public NotificationsView()
    {
        InitializeComponent();
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is NotificationsViewModel vm)
        {
            vm.FocusFirstItemRequested += (_, __) =>
                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
            await vm.InitializeAsync().ConfigureAwait(true);
        }
        FocusFirstItem();
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape && DataContext is NotificationsViewModel vm)
        {
            e.Handled = true;
            vm.HandleEscape();
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Delete && DataContext is NotificationsViewModel vm)
        {
            e.Handled = true;
            await vm.DeleteSelectedAsync().ConfigureAwait(true);
        }

        if ((e.Key == Key.Enter || e.Key == Key.Return) && DataContext is NotificationsViewModel vm2)
        {
            e.Handled = true;
            await vm2.MarkSelectedReadAsync().ConfigureAwait(true);
        }
    }

    private void FocusFirstItem()
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

        ItemsList.UpdateLayout();
        if (ItemsList.ItemContainerGenerator.ContainerFromIndex(ItemsList.SelectedIndex) is ListBoxItem item)
        {
            item.Focus();
            return;
        }

        ItemsList.Focus();
    }
}
