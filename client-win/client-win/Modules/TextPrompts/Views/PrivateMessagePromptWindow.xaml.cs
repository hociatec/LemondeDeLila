using System.Windows;
using System.Windows.Input;

namespace client_win.Modules.TextPrompts.Views;

public partial class PrivateMessagePromptWindow : Window
{
    public PrivateMessagePromptWindow()
    {
        InitializeComponent();
        Loaded += (_, __) => SubjectBox.Focus();
    }

    public (string Subject, string Message)? Result { get; private set; }

    private void OnOkClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is PrivateMessagePromptWindowModel vm)
        {
            Result = (vm.Subject, vm.Message);
        }
        DialogResult = true;
        Close();
    }

    private void OnCancelClick(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            DialogResult = false;
            Close();
        }
    }
}

