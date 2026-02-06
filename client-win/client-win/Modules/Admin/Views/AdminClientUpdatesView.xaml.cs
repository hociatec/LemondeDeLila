using System.Windows.Controls;

namespace client_win.Modules.Admin.Views;

public partial class AdminClientUpdatesView : UserControl
{
    public AdminClientUpdatesView()
    {
        InitializeComponent();
    }

    public TextBox? VersionTextBox => VersionInput;
    public TextBox? MessageTextBox => MessageInput;

    public void FocusPrimaryInput()
    {
        if (MessageInput != null)
        {
            MessageInput.Focus();
            MessageInput.SelectAll();
            return;
        }

        if (VersionInput == null)
        {
            return;
        }

        VersionInput.Focus();
        VersionInput.SelectAll();
    }
}
