using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Game.ViewModels;

namespace client_win.Modules.Game.Views;

public partial class RoomTableView : UserControl
{
    private RoomTableViewModel? _vm;
    private bool _historyVisible;

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
            FocusGame();
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
            // Bascule entre fenêtre de jeu et panneau historique (comme dans le client Java).
            if (_historyVisible)
            {
                FocusGame();
            }
            else
            {
                FocusHistory();
            }
            e.Handled = true;
            return;
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

        if (e.Key == Key.Q)
        {
            if (vm.CloseCommand.CanExecute(null))
            {
                vm.CloseCommand.Execute(null);
                e.Handled = true;
            }
            return;
        }
    }

    private void OnHistoryChanged(object? sender, System.Collections.Specialized.NotifyCollectionChangedEventArgs e)
    {
        if (HistoryList == null || HistoryList.Items.Count == 0)
        {
            return;
        }
        if (HistoryPanel != null && HistoryPanel.Visibility != System.Windows.Visibility.Visible)
        {
            return;
        }
        var last = HistoryList.Items[HistoryList.Items.Count - 1];
        HistoryList.ScrollIntoView(last);
    }

    private void FocusHistory()
    {
        if (HistoryPanel != null)
        {
            HistoryPanel.Visibility = System.Windows.Visibility.Visible;
        }
        _historyVisible = true;

        if (HistoryList == null)
        {
            return;
        }
        if (HistoryList.Items.Count > 0)
        {
            if (HistoryList.SelectedIndex < 0)
            {
                HistoryList.SelectedIndex = HistoryList.Items.Count - 1;
            }
            HistoryList.ScrollIntoView(HistoryList.SelectedItem);
        }
        HistoryList.Focus();
    }

    private void FocusGame()
    {
        if (HistoryPanel != null)
        {
            HistoryPanel.Visibility = System.Windows.Visibility.Collapsed;
        }
        _historyVisible = false;
        GamePanel?.Focus();
    }
}
