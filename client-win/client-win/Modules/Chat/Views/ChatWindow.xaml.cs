using System;
using System.Windows;
using client_win.Modules.Chat.ViewModels;
using System.Collections.Specialized;
using System.Windows.Input;

namespace client_win.Modules.Chat.Views;

public partial class ChatWindow : Window
{
    private INotifyCollectionChanged? _currentMessages;
    private bool _didInitialFocus;

    public ChatWindow()
    {
        InitializeComponent();
        Loaded += (_, _) => InputBox.Focus();
        Loaded += OnLoaded;
    }

    private void OnInputKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && DataContext is ChatViewModel vm && vm.SendCommand.CanExecute(null))
        {
            vm.SendCommand.Execute(null);
            e.Handled = true;
        }
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is ChatViewModel vm && vm.Messages is INotifyCollectionChanged coll)
        {
            if (_currentMessages != null)
            {
                _currentMessages.CollectionChanged -= OnMessagesChanged;
            }
            _currentMessages = coll;
            coll.CollectionChanged += OnMessagesChanged;
        }

        if (!_didInitialFocus)
        {
            _didInitialFocus = true;
            ScrollHistoryToEnd();
        }
    }

    private void OnMessagesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        ScrollHistoryToEnd();
    }

    private void ScrollHistoryToEnd()
    {
        if (HistoryBox == null)
        {
            return;
        }

        try
        {
            HistoryBox.CaretIndex = HistoryBox.Text?.Length ?? 0;
            HistoryBox.ScrollToEnd();
        }
        catch
        {
            // Best-effort: never crash the UI for a sound UX enhancement.
        }
    }

    // IMPORTANT: on ne surcharge pas les flèches dans les listes.
    // WPF + le lecteur d'écran gèrent mieux la lecture ligne par ligne sans interception.
}
