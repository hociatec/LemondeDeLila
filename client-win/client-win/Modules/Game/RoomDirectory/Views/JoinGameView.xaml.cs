using System;
using System.Collections.Specialized;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.RoomDirectory.ViewModels;

namespace client_win.Modules.Game.RoomDirectory.Views;

public partial class JoinGameView : UserControl
{
    private INotifyCollectionChanged? _roomsObservable;
    private int _lastRoomsCount = -1;

    public JoinGameView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        FocusWhenContainersGenerated();
        HookRoomsCollection(DataContext as JoinGameViewModel);
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        HookRoomsCollection(DataContext as JoinGameViewModel);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        HookRoomsCollection(null);
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            if (DataContext is JoinGameViewModel vm && vm.CloseCommand.CanExecute(null))
            {
                e.Handled = true;
                vm.CloseCommand.Execute(null);
            }
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not JoinGameViewModel vm)
        {
            return;
        }
        e.Handled = true;
        await vm.JoinSelectedCommand.ExecuteAsync(null).ConfigureAwait(true);
    }

    private void OnListKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab || e.Key == Key.System)
        {
            e.Handled = true;
        }
    }

    private void FocusFirstItem()
    {
        if (RoomsList == null || RoomsList.Items.Count == 0)
        {
            if (EmptyStateText != null && EmptyStateText.IsVisible)
            {
                EmptyStateText.Focus();
                Keyboard.Focus(EmptyStateText);
                return;
            }

            RoomsList?.Focus();
            return;
        }

        if (RoomsList.SelectedIndex < 0)
        {
            RoomsList.SelectedIndex = 0;
        }

        RoomsList.UpdateLayout();
        if (RoomsList.ItemContainerGenerator.ContainerFromIndex(RoomsList.SelectedIndex) is ListBoxItem item)
        {
            item.Focus();
        }
        else
        {
            RoomsList.Focus();
        }
    }

    private void FocusWhenContainersGenerated()
    {
        if (RoomsList == null)
        {
            return;
        }

        if (RoomsList.HasItems &&
            RoomsList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
            return;
        }

        EventHandler? handler = null;
        handler = (_, __) =>
        {
            if (RoomsList.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
            {
                return;
            }

            RoomsList.ItemContainerGenerator.StatusChanged -= handler;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
        };
        RoomsList.ItemContainerGenerator.StatusChanged += handler;
    }

    private void HookRoomsCollection(JoinGameViewModel? vm)
    {
        if (_roomsObservable != null)
        {
            _roomsObservable.CollectionChanged -= OnRoomsCollectionChanged;
            _roomsObservable = null;
        }

        if (vm == null)
        {
            _lastRoomsCount = -1;
            return;
        }

        _roomsObservable = vm.Rooms;
        _roomsObservable.CollectionChanged += OnRoomsCollectionChanged;
        _lastRoomsCount = vm.Rooms.Count;
    }

    private void OnRoomsCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (DataContext is not JoinGameViewModel vm)
        {
            return;
        }

        var current = vm.Rooms.Count;
        if (current == _lastRoomsCount)
        {
            return;
        }
        _lastRoomsCount = current;

        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() =>
            {
                // Assure un focus "utile" pour lecteurs d'écran quand la liste devient vide ou se remplit.
                FocusWhenContainersGenerated();
            }));
    }
}
