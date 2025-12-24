using System;
using System.Globalization;
using System.Windows.Data;

namespace client_win.Modules.Messaging.Views;

/// <summary>
/// Converts null to true, non-null to false
/// </summary>
public sealed class NullToBoolConverter : IValueConverter
{
    public static readonly NullToBoolConverter Instance = new();

    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        return value == null;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
