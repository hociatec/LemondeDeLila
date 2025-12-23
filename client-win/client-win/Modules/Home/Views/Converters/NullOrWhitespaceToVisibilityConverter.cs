using System;
using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace client_win.Modules.Home.Views.Converters;

public sealed class NullOrWhitespaceToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        string text = value as string ?? string.Empty;
        bool hide = string.IsNullOrWhiteSpace(text);
        return hide ? Visibility.Collapsed : Visibility.Visible;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
