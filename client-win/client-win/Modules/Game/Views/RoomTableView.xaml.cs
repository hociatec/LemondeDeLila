using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Game.ViewModels;

namespace client_win.Modules.Game.Views;

public partial class RoomTableView : UserControl
{
    public RoomTableView()
    {
        InitializeComponent();
    }

    private async void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        if (DataContext is RoomTableViewModel vm)
        {
            await vm.InitializeAsync().ConfigureAwait(true);
        }
    }

    private async void OnUnloaded(object sender, System.Windows.RoutedEventArgs e)
    {
        if (DataContext is RoomTableViewModel vm)
        {
            await vm.ShutdownAsync().ConfigureAwait(true);
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not RoomTableViewModel vm)
        {
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
}
