using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Presence.ViewModels;

namespace client_win.Modules.Presence.Views;

public partial class PresenceView : UserControl
{
    private PresenceViewModel? _viewModel;

    public PresenceView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        FocusCurrentPage();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (_viewModel != null)
        {
            _viewModel.FocusFirstItemRequested -= OnFocusFirstItemRequested;
            _viewModel = null;
        }

        if (e.NewValue is PresenceViewModel vm)
        {
            _viewModel = vm;
            vm.FocusFirstItemRequested += OnFocusFirstItemRequested;
        }
    }

    private void OnFocusFirstItemRequested()
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (ItemsList != null && ItemsList.Items.Count > 0)
            {
                // Forcer un changement de sélection pour déclencher l'annonce SR
                // quand on entre dans une page (sinon il faut parfois appuyer sur ↓).
                ItemsList.SelectedIndex = -1;
                ItemsList.SelectedIndex = 0;
                ItemsList.ScrollIntoView(ItemsList.Items[0]);
            }
            FocusWhenContainersGenerated();
        }));
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Escape && DataContext is PresenceViewModel vm)
        {
            e.Handled = true;
            vm.HandleEscape();
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusCurrentPage));
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not PresenceViewModel vm)
        {
            return;
        }
        e.Handled = true;
        await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusCurrentPage));
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

        Focus();
    }

    private void FocusSelectedOrFirstItem()
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

        if (ItemsList.SelectedIndex >= 0 && ItemsList.SelectedIndex < ItemsList.Items.Count)
        {
            ItemsList.ScrollIntoView(ItemsList.Items[ItemsList.SelectedIndex]);
        }

        ItemsList.UpdateLayout();
        if (ItemsList.SelectedIndex >= 0 &&
            ItemsList.ItemContainerGenerator.ContainerFromIndex(ItemsList.SelectedIndex) is ListBoxItem item)
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedOrFirstItem));
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedOrFirstItem));
        };
        ItemsList.ItemContainerGenerator.StatusChanged += handler;
    }
}
