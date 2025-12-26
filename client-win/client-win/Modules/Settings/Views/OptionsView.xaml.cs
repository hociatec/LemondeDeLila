using System;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Settings.ViewModels;

namespace client_win.Modules.Settings.Views;

public partial class OptionsView : UserControl
{
    public OptionsView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            FirstFocusable?.Focus();
        }));
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Escape)
        {
            return;
        }

        if (DataContext is OptionsViewModel vm && vm.CancelCommand?.CanExecute(null) == true)
        {
            e.Handled = true;
            vm.CancelCommand.Execute(null);
        }
    }
}

