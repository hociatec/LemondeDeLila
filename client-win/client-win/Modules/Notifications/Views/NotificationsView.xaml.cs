using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Notifications.ViewModels;

namespace client_win.Modules.Notifications.Views;

public partial class NotificationsView : UserControl
{
    private NotificationsViewModel? _vm;
    private EventHandler? _focusHandler;

    public NotificationsView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is NotificationsViewModel vm)
        {
            HookVm(vm);
            try
            {
                await vm.InitializeAsync().ConfigureAwait(true);
            }
            catch
            {
                // Best-effort: éviter de bloquer l'UI si le WS est indisponible.
            }
        }
        FocusFirstItem();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        HookVm(DataContext as NotificationsViewModel);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        HookVm(null);
    }

    private void HookVm(NotificationsViewModel? vm)
    {
        if (_vm != null && _focusHandler != null)
        {
            _vm.FocusFirstItemRequested -= _focusHandler;
        }

        _vm = vm;
        _focusHandler = null;

        if (_vm == null)
        {
            return;
        }

        _focusHandler = (_, __) =>
            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
        _vm.FocusFirstItemRequested += _focusHandler;
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

    private void OnItemsLoaded(object sender, RoutedEventArgs e)
    {
        FocusFirstItem();
    }

    private void FocusReplyBox()
    {
        if (ReplyBox == null)
        {
            return;
        }

        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            ReplyBox.Focus();
            ReplyBox.SelectAll();
        }));
    }

    private void OnReplyClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not NotificationsViewModel vm)
        {
            return;
        }

        vm.ReplyCommand.Execute(null);
        FocusReplyBox();
        e.Handled = true;
    }
}
