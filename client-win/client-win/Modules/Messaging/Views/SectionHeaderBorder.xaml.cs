using System.Windows;
using System.Windows.Controls;

namespace client_win.Modules.Messaging.Views;

public partial class SectionHeaderBorder : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(
            nameof(Title),
            typeof(string),
            typeof(SectionHeaderBorder),
            new PropertyMetadata(string.Empty));

    public SectionHeaderBorder()
    {
        InitializeComponent();
    }

    public string Title
    {
        get => (string)GetValue(TitleProperty);
        set => SetValue(TitleProperty, value);
    }
}
