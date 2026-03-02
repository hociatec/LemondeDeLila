using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Notifications.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Notifications.Views;

public partial class NotificationsView : UserControl, IInitialFocusTarget
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
            _ = InitializeVmAsync(vm);
        }
        FocusFirstItem(FocusPolicyReason.InitialLoad);
    }

    private static async Task InitializeVmAsync(NotificationsViewModel vm)
    {
        try
        {
            await vm.InitializeAsync().ConfigureAwait(true);
        }
        catch
        {
            // Best-effort: éviter de bloquer l'UI si le WS est indisponible.
        }
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
            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => FocusFirstItem(FocusPolicyReason.Update)));
        _vm.FocusFirstItemRequested += _focusHandler;
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape && DataContext is NotificationsViewModel vm)
        {
            e.Handled = true;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    var stayOpen = vm.HandleEscape();
                    if (stayOpen &&
                        IsLoaded &&
                        IsVisible &&
                        ReferenceEquals(DataContext, vm))
                    {
                        FocusFirstItem(FocusPolicyReason.UserRequest);
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
            return;
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Delete && DataContext is NotificationsViewModel vm)
        {
            e.Handled = true;
            await vm.DeleteSelectedAsync().ConfigureAwait(true);
        }

        if (e.Key == Key.H && DataContext is NotificationsViewModel vmH)
        {
            e.Handled = true;
            await vmH.ToggleHandledAsync().ConfigureAwait(true);
        }

        if (e.Key == Key.P && DataContext is NotificationsViewModel vmP)
        {
            e.Handled = true;
            await vmP.SetInProgressAsync().ConfigureAwait(true);
        }

        if (e.Key == Key.U && DataContext is NotificationsViewModel vmU)
        {
            e.Handled = true;
            await vmU.SetOpenAsync().ConfigureAwait(true);
        }

        if ((e.Key == Key.Enter || e.Key == Key.Return) && DataContext is NotificationsViewModel vm2)
        {
            e.Handled = true;
            await vm2.MarkSelectedReadAsync().ConfigureAwait(true);
        }
    }

    private void FocusFirstItem(FocusPolicyReason reason)
    {
        if (ItemsList == null)
        {
            return;
        }

        if (!FocusPolicy.CanFocus(this, reason))
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

        var index = ItemsList.SelectedIndex;
        if (index >= 0 && index < ItemsList.Items.Count)
        {
            ItemsList.ScrollIntoView(ItemsList.Items[index]);
        }

        if (index >= 0 && ItemsList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            return;
        }

        ItemsList.Focus();
    }

    private void OnItemsLoaded(object sender, RoutedEventArgs e)
    {
        FocusFirstItem(FocusPolicyReason.InitialLoad);
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

    public void RequestInitialFocus()
    {
        FocusFirstItem(FocusPolicyReason.InitialLoad);
    }
}
