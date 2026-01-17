using System;
using System.Collections.Specialized;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.RoomDirectory.ViewModels;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.RoomDirectory.Views;

public partial class JoinGameView : UserControl, IInitialFocusTarget
{
    private INotifyCollectionChanged? _roomsObservable;
    private int _lastRoomsCount = -1;
    private Window? _hostWindow;
    private bool _isActive;

    public JoinGameView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _isActive = true;
        HookRoomsCollection(DataContext as JoinGameViewModel);
        HookWindowEscape();
        HookEmptyVisibility();
        FocusAfterLoad();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        HookRoomsCollection(DataContext as JoinGameViewModel);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _isActive = false;
        UnhookWindowEscape();
        UnhookEmptyVisibility();
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

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Escape)
        {
            return;
        }

        // Preview => fiable même si un contrôle enfant absorbe KeyDown.
        if (DataContext is JoinGameViewModel vm && vm.CloseCommand.CanExecute(null))
        {
            e.Handled = true;
            vm.CloseCommand.Execute(null);
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
            if (EmptyOnlyText != null && EmptyOnlyText.IsVisible)
            {
                EmptyOnlyText.Focus();
                Keyboard.Focus(EmptyOnlyText);
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

    private void FocusAfterLoad()
    {
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() =>
            {
                if (!_isActive || !IsVisible)
                {
                    return;
                }
                FocusEmptyOrList();
            }));
    }

    private void FocusEmptyOrList()
    {
        // Calqué sur MessagingView: si la liste est vide, focus sur le texte vide
        // (NVDA annonce plus fiablement un focus sur un élément simple).
        if (DataContext is JoinGameViewModel vm && vm.Rooms.Count == 0)
        {
            if (EmptyOnlyText != null && EmptyOnlyText.IsVisible)
            {
                EmptyOnlyText.Focus();
                Keyboard.Focus(EmptyOnlyText);
                return;
            }
        }

        FocusWhenContainersGenerated();
    }

    private void HookEmptyVisibility()
    {
        if (EmptyOnlyText == null)
        {
            return;
        }
        EmptyOnlyText.IsVisibleChanged -= OnEmptyOnlyTextIsVisibleChanged;
        EmptyOnlyText.IsVisibleChanged += OnEmptyOnlyTextIsVisibleChanged;
    }

    private void UnhookEmptyVisibility()
    {
        if (EmptyOnlyText == null)
        {
            return;
        }
        EmptyOnlyText.IsVisibleChanged -= OnEmptyOnlyTextIsVisibleChanged;
    }

    private void OnEmptyOnlyTextIsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (EmptyOnlyText == null || EmptyOnlyText.IsVisible != true)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() =>
            {
                try
                {
                    if (!_isActive || !IsVisible)
                    {
                        return;
                    }
                    EmptyOnlyText.Focus();
                    Keyboard.Focus(EmptyOnlyText);
                }
                catch
                {
                    // ignore
                }
            }));
    }

    private void FocusWhenContainersGenerated()
    {
        if (RoomsList == null)
        {
            return;
        }

        if (!RoomsList.HasItems)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
            return;
        }

        if (RoomsList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
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
        if (!_isActive || !IsVisible)
        {
            return;
        }

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
                if (!_isActive || !IsVisible)
                {
                    return;
                }
                FocusEmptyOrList();
            }));
    }

    private void HookWindowEscape()
    {
        try
        {
            var win = Window.GetWindow(this);
            if (win == null || ReferenceEquals(_hostWindow, win))
            {
                return;
            }
            UnhookWindowEscape();
            _hostWindow = win;
            _hostWindow.PreviewKeyDown += OnWindowPreviewKeyDown;
        }
        catch
        {
            // ignore
        }
    }

    private void UnhookWindowEscape()
    {
        try
        {
            if (_hostWindow != null)
            {
                _hostWindow.PreviewKeyDown -= OnWindowPreviewKeyDown;
            }
        }
        catch
        {
            // ignore
        }
        finally
        {
            _hostWindow = null;
        }
    }

    private void OnWindowPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Escape)
        {
            return;
        }
        if (!_isActive || !IsVisible)
        {
            return;
        }
        if (DataContext is JoinGameViewModel vm && vm.CloseCommand.CanExecute(null))
        {
            e.Handled = true;
            vm.CloseCommand.Execute(null);
        }
    }

    public void RequestInitialFocus()
    {
        FocusEmptyOrList();
    }
}
