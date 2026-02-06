using System;
using System.Windows.Controls;
using System.Windows.Threading;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Shell.Views;

public partial class BootstrapShellView : UserControl, IInitialFocusTarget
{
    public BootstrapShellView()
    {
        InitializeComponent();
    }

    public void RequestInitialFocus()
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            try { FocusParking.Park(System.Windows.Window.GetWindow(this)); } catch { }
        }));
    }
}
