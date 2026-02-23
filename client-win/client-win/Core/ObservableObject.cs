using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using client_win.Core.Text;

namespace client_win.Core;

/// <summary>
/// Lightweight base for view models to raise property change notifications.
/// </summary>
public abstract class ObservableObject : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (value is string text)
        {
            value = (T)(object)MojibakeTextRepair.Fix(text);
        }

        if (EqualityComparer<T>.Default.Equals(field, value))
        {
            return false;
        }

        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
