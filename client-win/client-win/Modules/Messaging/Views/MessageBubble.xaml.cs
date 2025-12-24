using System.Windows;
using System.Windows.Controls;
using client_win.Modules.Messaging.Models;

namespace client_win.Modules.Messaging.Views;

public partial class MessageBubble : UserControl
{
    public static readonly DependencyProperty MessageProperty =
        DependencyProperty.Register(
            nameof(Message),
            typeof(MessagingMessage),
            typeof(MessageBubble),
            new PropertyMetadata(null));

    public MessageBubble()
    {
        InitializeComponent();
    }

    public MessagingMessage? Message
    {
        get => (MessagingMessage?)GetValue(MessageProperty);
        set => SetValue(MessageProperty, value);
    }
}
