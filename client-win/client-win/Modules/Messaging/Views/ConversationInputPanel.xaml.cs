using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.Messaging.Views;

public partial class ConversationInputPanel : UserControl
{
    public static readonly DependencyProperty InputTextProperty =
        DependencyProperty.Register(
            nameof(InputText),
            typeof(string),
            typeof(ConversationInputPanel),
            new FrameworkPropertyMetadata(string.Empty, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

    public static readonly DependencyProperty SendCommandProperty =
        DependencyProperty.Register(
            nameof(SendCommand),
            typeof(ICommand),
            typeof(ConversationInputPanel),
            new PropertyMetadata(null));

    public event EventHandler<KeyEventArgs>? InputKeyDown;

    public ConversationInputPanel()
    {
        InitializeComponent();

        // Wire up the KeyDown event from the inner TextBox
        InputBox.Loaded += (s, e) =>
        {
            if (InputBox.InternalTextBox != null)
            {
                InputBox.InternalTextBox.KeyDown += OnInnerTextBoxKeyDown;
            }
        };
    }

    public string InputText
    {
        get => (string)GetValue(InputTextProperty);
        set => SetValue(InputTextProperty, value);
    }

    public ICommand? SendCommand
    {
        get => (ICommand?)GetValue(SendCommandProperty);
        set => SetValue(SendCommandProperty, value);
    }

    private void OnInnerTextBoxKeyDown(object sender, KeyEventArgs e)
    {
        InputKeyDown?.Invoke(this, e);
    }

    /// <summary>
    /// Sets focus to the input field
    /// </summary>
    public new bool Focus()
    {
        return InputBox.Focus();
    }
}
