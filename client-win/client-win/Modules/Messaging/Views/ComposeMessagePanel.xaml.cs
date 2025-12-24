using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.Messaging.Views;

public partial class ComposeMessagePanel : UserControl
{
    public static readonly DependencyProperty RecipientProperty =
        DependencyProperty.Register(
            nameof(Recipient),
            typeof(string),
            typeof(ComposeMessagePanel),
            new FrameworkPropertyMetadata(string.Empty, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

    public static readonly DependencyProperty SubjectProperty =
        DependencyProperty.Register(
            nameof(Subject),
            typeof(string),
            typeof(ComposeMessagePanel),
            new FrameworkPropertyMetadata(string.Empty, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

    public static readonly DependencyProperty MessageBodyProperty =
        DependencyProperty.Register(
            nameof(MessageBody),
            typeof(string),
            typeof(ComposeMessagePanel),
            new FrameworkPropertyMetadata(string.Empty, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

    public static readonly DependencyProperty SendCommandProperty =
        DependencyProperty.Register(
            nameof(SendCommand),
            typeof(ICommand),
            typeof(ComposeMessagePanel),
            new PropertyMetadata(null));

    public ComposeMessagePanel()
    {
        InitializeComponent();
    }

    public string Recipient
    {
        get => (string)GetValue(RecipientProperty);
        set => SetValue(RecipientProperty, value);
    }

    public string Subject
    {
        get => (string)GetValue(SubjectProperty);
        set => SetValue(SubjectProperty, value);
    }

    public string MessageBody
    {
        get => (string)GetValue(MessageBodyProperty);
        set => SetValue(MessageBodyProperty, value);
    }

    public ICommand? SendCommand
    {
        get => (ICommand?)GetValue(SendCommandProperty);
        set => SetValue(SendCommandProperty, value);
    }

    /// <summary>
    /// Sets focus to the first field (Recipient)
    /// </summary>
    public void FocusFirstField()
    {
        RecipientTextBox.Focus();
    }
}
