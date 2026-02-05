using System;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
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
            try { FocusAnchor?.Focus(); } catch { }
            try { Keyboard.Focus(FocusAnchor); } catch { }
        }));
    }
}
