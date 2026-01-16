using System.Windows.Controls;

namespace client_win.Modules.Admin.Views;

public partial class AdminInputsView : UserControl
{
    public AdminInputsView()
    {
        InitializeComponent();
    }

    public TextBox? PrimaryInputBox => PrimaryInput;

    public TextBox? SecondaryInputTextBox => SecondaryInputBox;

    public TextBox? ThirdInputTextBox => ThirdInputBox;

    public TextBox? FourthInputTextBox => FourthInputBox;

    public TextBox? FifthInputTextBox => FifthInputBox;
}
