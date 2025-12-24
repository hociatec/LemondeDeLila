using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Game.ViewModels;

namespace client_win.Modules.Game.Views;

public partial class JoinGameView : UserControl
{
    public JoinGameView()
    {
        InitializeComponent();
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not JoinGameViewModel vm)
        {
            return;
        }

        if (e.Key == Key.Escape)
        {
            if (vm.CloseCommand.CanExecute(null))
            {
                vm.CloseCommand.Execute(null);
                e.Handled = true;
            }
            return;
        }

        if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control) && e.Key == Key.C)
        {
            if (vm.SpectateCommand.CanExecute(null))
            {
                vm.SpectateCommand.Execute(null);
                e.Handled = true;
            }
        }
    }

    private void OnRoomsKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter || DataContext is not JoinGameViewModel vm)
        {
            return;
        }

        if (vm.JoinCommand.CanExecute(null))
        {
            vm.JoinCommand.Execute(null);
        }
        e.Handled = true;
    }
}
