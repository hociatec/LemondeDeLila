using System.Windows.Controls;

namespace client_win.Modules.Admin.Views;

public partial class AdminClientUpdatesView : UserControl
{
    public AdminClientUpdatesView()
    {
        InitializeComponent();
    }

    public TextBox? DelayTextBox => DelayInput;
    public TextBox? MessageTextBox => MessageInput;

    public void FocusPrimaryInput()
    {
        if (DelayInput != null)
        {
            DelayInput.Focus();
            DelayInput.SelectAll();
            return;
        }

        if (MessageInput != null)
        {
            MessageInput.Focus();
            MessageInput.SelectAll();
            return;
        }
    }
}
