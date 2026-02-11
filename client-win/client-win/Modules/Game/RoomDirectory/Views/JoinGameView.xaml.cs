using System;
using System.Collections.Specialized;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.RoomDirectory.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.RoomDirectory.Views;

public partial class JoinGameView : UserControl, IInitialFocusTarget, IFocusReady
{
    private INotifyCollectionChanged? _roomsObservable;
    private int _lastRoomsCount = -1;
    private Window? _hostWindow;
    private bool _isActive;
    private int _focusRequestId;
    private bool _isFocusReady;
    private bool _containersHooked;

    public JoinGameView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
        IsVisibleChanged += OnIsVisibleChanged;
    }

    public bool IsFocusReady => _isFocusReady;

    public event EventHandler? FocusReadyChanged;

    private void OnIsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (IsVisible != true)
        {
            return;
        }

        UpdateFocusReady();

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            try
            {
                if (!IsVisible || IsKeyboardFocusWithin)
                {
                    return;
                }

                FocusEmptyOrList();
            }
            catch
            {
                // ignore
            }
        }));
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _isActive = true;
        HookRoomsCollection(DataContext as JoinGameViewModel);
        HookWindowEscape();
        HookEmptyVisibility();

        try
        {
            if (!_containersHooked && RoomsList != null)
            {
                _containersHooked = true;
                RoomsList.ItemContainerGenerator.StatusChanged += OnRoomsContainersStatusChanged;
            }
        }
        catch
        {
            // ignore
        }

        UpdateFocusReady();
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
        try
        {
            if (_containersHooked && RoomsList != null)
            {
                RoomsList.ItemContainerGenerator.StatusChanged -= OnRoomsContainersStatusChanged;
            }
        }
        catch
        {
            // ignore
        }
        _containersHooked = false;
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            if (DataContext is JoinGameViewModel vm && vm.CloseCommand.CanExecute(null))
            {
                e.Handled = true;
                ExecuteCloseDeferred(vm);
            }
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled)
        {
            return;
        }

        // Keep navigation inside the view (Tab can otherwise escape to the shell host).
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            return;
        }

        if (e.Key != Key.Escape)
        {
            return;
        }

        // Preview => fiable même si un contrôle enfant absorbe KeyDown.
        if (DataContext is JoinGameViewModel vm && vm.CloseCommand.CanExecute(null))
        {
            e.Handled = true;
            ExecuteCloseDeferred(vm);
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

        // IMPORTANT (NVDA): exécuter l'action après l'événement clavier.
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
        {
            try
            {
                await vm.JoinSelectedCommand.ExecuteAsync(null).ConfigureAwait(true);
            }
            catch
            {
                // best-effort
            }
        }));
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
        void FocusSelectedWithRetry(int requestId, int attemptsRemaining)
        {
            if (RoomsList == null || RoomsList.Items.Count == 0)
            {
                RoomsList?.Focus();
                return;
            }

            if (RoomsList.SelectedIndex < 0)
            {
                RoomsList.SelectedIndex = 0;
            }

            var index = RoomsList.SelectedIndex;
            if (index >= 0 && index < RoomsList.Items.Count)
            {
                RoomsList.ScrollIntoView(RoomsList.Items[index]);
            }

            if (index >= 0 && RoomsList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
            {
                item.Focus();
                return;
            }

            if (attemptsRemaining > 0 && requestId == _focusRequestId)
            {
                _ = Dispatcher.BeginInvoke(
                    DispatcherPriority.Loaded,
                    new Action(() => FocusSelectedWithRetry(requestId, attemptsRemaining - 1)));
                return;
            }

            RoomsList.Focus();
        }

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

        var id = unchecked(++_focusRequestId);
        FocusSelectedWithRetry(id, attemptsRemaining: 8);
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

        UpdateFocusReady();

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
        UpdateFocusReady();

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

    private void OnRoomsContainersStatusChanged(object? sender, EventArgs e)
    {
        UpdateFocusReady();
    }

    private void UpdateFocusReady()
    {
        try
        {
            var ready = ComputeFocusReady();
            if (ready == _isFocusReady)
            {
                return;
            }

            _isFocusReady = ready;
            FocusReadyChanged?.Invoke(this, EventArgs.Empty);
        }
        catch
        {
            // ignore
        }
    }

    private bool ComputeFocusReady()
    {
        if (!IsLoaded || !IsVisible)
        {
            return false;
        }

        if (EmptyOnlyText != null && EmptyOnlyText.IsVisible)
        {
            return true;
        }

        if (RoomsList == null)
        {
            return false;
        }

        if (RoomsList.Items.Count == 0)
        {
            return true;
        }

        return RoomsList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated;
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
            ExecuteCloseDeferred(vm);
        }
    }

    private void ExecuteCloseDeferred(JoinGameViewModel vm)
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            try
            {
                if (vm.CloseCommand.CanExecute(null))
                {
                    vm.CloseCommand.Execute(null);
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    public void RequestInitialFocus()
    {
        FocusEmptyOrList();
    }
}
