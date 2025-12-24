using System.Windows;
using System.Windows.Controls;

namespace client_win.Modules.Messaging.Views;

public partial class PlaceholderTextBox : UserControl
{
    public static readonly DependencyProperty TextProperty =
        DependencyProperty.Register(
            nameof(Text),
            typeof(string),
            typeof(PlaceholderTextBox),
            new FrameworkPropertyMetadata(string.Empty, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

    public static readonly DependencyProperty PlaceholderProperty =
        DependencyProperty.Register(
            nameof(Placeholder),
            typeof(string),
            typeof(PlaceholderTextBox),
            new PropertyMetadata(string.Empty));

    public static readonly DependencyProperty AcceptsReturnProperty =
        DependencyProperty.Register(
            nameof(AcceptsReturn),
            typeof(bool),
            typeof(PlaceholderTextBox),
            new PropertyMetadata(false));

    public static readonly DependencyProperty AcceptsTabProperty =
        DependencyProperty.Register(
            nameof(AcceptsTab),
            typeof(bool),
            typeof(PlaceholderTextBox),
            new PropertyMetadata(false));

    public new static readonly DependencyProperty MinHeightProperty =
        DependencyProperty.Register(
            nameof(MinHeight),
            typeof(double),
            typeof(PlaceholderTextBox),
            new PropertyMetadata(0.0));

    public new static readonly DependencyProperty VerticalContentAlignmentProperty =
        DependencyProperty.Register(
            nameof(VerticalContentAlignment),
            typeof(VerticalAlignment),
            typeof(PlaceholderTextBox),
            new PropertyMetadata(VerticalAlignment.Top));

    public PlaceholderTextBox()
    {
        InitializeComponent();
    }

    public string Text
    {
        get => (string)GetValue(TextProperty);
        set => SetValue(TextProperty, value);
    }

    public string Placeholder
    {
        get => (string)GetValue(PlaceholderProperty);
        set => SetValue(PlaceholderProperty, value);
    }

    public bool AcceptsReturn
    {
        get => (bool)GetValue(AcceptsReturnProperty);
        set => SetValue(AcceptsReturnProperty, value);
    }

    public bool AcceptsTab
    {
        get => (bool)GetValue(AcceptsTabProperty);
        set => SetValue(AcceptsTabProperty, value);
    }

    public new double MinHeight
    {
        get => (double)GetValue(MinHeightProperty);
        set => SetValue(MinHeightProperty, value);
    }

    public new VerticalAlignment VerticalContentAlignment
    {
        get => (VerticalAlignment)GetValue(VerticalContentAlignmentProperty);
        set => SetValue(VerticalContentAlignmentProperty, value);
    }

    /// <summary>
    /// Exposes the internal TextBox for event wiring
    /// </summary>
    public TextBox? InternalTextBox => InnerTextBox;

    /// <summary>
    /// Sets focus to the internal TextBox
    /// </summary>
    public new bool Focus()
    {
        return InnerTextBox.Focus();
    }
}
