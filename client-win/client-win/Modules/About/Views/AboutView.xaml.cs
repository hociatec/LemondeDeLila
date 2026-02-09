using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.About.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.About.Views;

public partial class AboutView : UserControl, IInitialFocusTarget
{
    private int _focusRequestId;
    public AboutView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        FocusCurrentPage();
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            if (DataContext is AboutViewModel aboutVm && aboutVm.ShowContactAdmin)
            {
                return;
            }

            e.Handled = true;
            return;
        }

        if (e.Key == Key.Escape && DataContext is AboutViewModel vm)
        {
            e.Handled = true;
            FocusParking.Park();
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    var result = vm.HandleEscape();
                    if (result != AboutNavResult.Closed &&
                        IsLoaded &&
                        IsVisible &&
                        ReferenceEquals(DataContext, vm))
                    {
                        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusCurrentPage));
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not AboutViewModel vm)
        {
            return;
        }
        e.Handled = true;

        // IMPORTANT (NVDA): exécuter l'action après l'événement clavier.
        FocusParking.Park();
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
        {
            try
            {
                await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
                if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                {
                    _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusCurrentPage));
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void OnListKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
        }
    }

    private void FocusCurrentPage()
    {
        if (ItemsList != null && ItemsList.IsVisible)
        {
            FocusWhenContainersGenerated();
            return;
        }

        if (ShortcutsBox != null && ShortcutsBox.IsVisible)
        {
            ShortcutsBox.Focus();
            return;
        }

        if (ContactMessageBox != null && ContactMessageBox.IsVisible)
        {
            ContactMessageBox.Focus();
            return;
        }

        Focus();
    }

    private void FocusFirstItem()
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            ItemsList?.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        var requestId = unchecked(++_focusRequestId);
        FocusSelectedOrFirstItemWithRetry(requestId, attemptsRemaining: 8);
    }

    private void FocusSelectedOrFirstItemWithRetry(int requestId, int attemptsRemaining)
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            ItemsList?.Focus();
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

        if (attemptsRemaining > 0 && requestId == _focusRequestId)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Loaded,
                new Action(() => FocusSelectedOrFirstItemWithRetry(requestId, attemptsRemaining - 1)));
            return;
        }

        ItemsList.Focus();
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

    public void RequestInitialFocus()
    {
        FocusCurrentPage();
    }
}
