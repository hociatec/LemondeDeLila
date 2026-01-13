using System.Windows;
using System.Windows.Input;

namespace client_win.Modules.TextPrompts.Views;

public partial class TextPromptWindow : Window
{
    public TextPromptWindow()
    {
        InitializeComponent();
        Loaded += (_, __) => InputBox.Focus();
    }

    public string? Result { get; private set; }

    private void OnOkClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is TextPromptWindowModel vm)
        {
            Result = vm.Text;
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
