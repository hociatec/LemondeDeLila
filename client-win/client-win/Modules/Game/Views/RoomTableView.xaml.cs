using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Game.ViewModels;

namespace client_win.Modules.Game.Views;

public partial class RoomTableView : UserControl
{
    private RoomTableViewModel? _vm;

    public RoomTableView()
    {
        InitializeComponent();
    }

    private async void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        if (DataContext is RoomTableViewModel vm)
        {
            _vm = vm;
            vm.History.CollectionChanged += OnHistoryChanged;
            await vm.InitializeAsync().ConfigureAwait(true);
        }
    }

    private async void OnUnloaded(object sender, System.Windows.RoutedEventArgs e)
    {
        if (_vm != null)
        {
            _vm.History.CollectionChanged -= OnHistoryChanged;
            await _vm.ShutdownAsync().ConfigureAwait(true);
            _vm = null;
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not RoomTableViewModel vm)
        {
            return;
        }

        if (e.Key == Key.Tab)
        {
            if (Keyboard.Modifiers.HasFlag(ModifierKeys.Shift))
            {
                if (ActionsPanel?.IsKeyboardFocusWithin == true)
                {
                    HistoryList?.Focus();
                    e.Handled = true;
                }
            }
            else
            {
                if (HistoryList?.IsKeyboardFocusWithin == true)
                {
                    FocusFirstAction();
                    e.Handled = true;
                }
            }
            if (e.Handled)
            {
                return;
            }
        }

        if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control))
        {
            if (e.Key == Key.H)
            {
                if (vm.TogglePrivacyCommand.CanExecute(null))
                {
                    vm.TogglePrivacyCommand.Execute(null);
                    e.Handled = true;
                }
            }
            else if (e.Key == Key.C)
            {
                if (vm.ToggleRoleCommand.CanExecute(null))
                {
                    vm.ToggleRoleCommand.Execute(null);
                    e.Handled = true;
                }
            }
            return;
        }

        if (e.Key == Key.Enter)
        {
            if (vm.StartGameCommand.CanExecute(null))
            {
                vm.StartGameCommand.Execute(null);
                e.Handled = true;
            }
            return;
        }

        if (e.Key == Key.X)
        {
            if (vm.ResetGameCommand.CanExecute(null))
            {
                vm.ResetGameCommand.Execute(null);
                e.Handled = true;
            }
            return;
        }

        if (e.Key == Key.W)
        {
            vm.AnnounceTableSummary();
            e.Handled = true;
            return;
        }

        if (e.Key == Key.T)
        {
            vm.AnnounceTurnInfo();
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Q)
        {
            if (vm.CloseCommand.CanExecute(null))
            {
                vm.CloseCommand.Execute(null);
                e.Handled = true;
            }
            return;
        }

        if (e.Key == Key.B)
        {
            if (Keyboard.Modifiers.HasFlag(ModifierKeys.Shift))
            {
                if (vm.RemoveBotCommand.CanExecute(null))
                {
                    vm.RemoveBotCommand.Execute(null);
                    e.Handled = true;
                }
            }
            else
            {
                if (vm.AddBotCommand.CanExecute(null))
                {
                    vm.AddBotCommand.Execute(null);
                    e.Handled = true;
                }
            }
        }
    }

    private void OnHistoryChanged(object? sender, System.Collections.Specialized.NotifyCollectionChangedEventArgs e)
    {
        if (HistoryList == null || HistoryList.Items.Count == 0)
        {
            return;
        }
        var last = HistoryList.Items[HistoryList.Items.Count - 1];
        HistoryList.ScrollIntoView(last);
    }

    private void FocusFirstAction()
    {
        if (ActionsPanel == null)
        {
            return;
        }
        foreach (var child in ActionsPanel.Children)
        {
            if (child is Button button && button.IsEnabled)
            {
                button.Focus();
                return;
            }
        }
        ActionsPanel.Focus();
    }
}
