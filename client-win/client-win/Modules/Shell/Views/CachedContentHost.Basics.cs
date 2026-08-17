using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost : UserControl, ICurrentContentRootProvider
{
    public CachedContentHost()
    {
        InitializeComponent();
        Loaded += (_, _) => BeginFocusPass();
        Unloaded += (_, _) => DetachCurrentRootObservers();

        try
        {
            AddHandler(
                Keyboard.GotKeyboardFocusEvent,
                new KeyboardFocusChangedEventHandler(OnGotKeyboardFocus),
                handledEventsToo: true);
        }
        catch
        {
            // best-effort
        }
    }

    public object? CurrentContent
    {
        get => GetValue(CurrentContentProperty);
        set => SetValue(CurrentContentProperty, value);
    }

    public DependencyObject? TryGetCurrentContentRoot()
        => _current != null
            ? CachedContentHostVisualTree.TryGetPresenterRoot(_current.Presenter)
            : null;
}
