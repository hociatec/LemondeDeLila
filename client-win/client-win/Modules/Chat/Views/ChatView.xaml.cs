using System;
using System.Collections.Specialized;
using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Chat.ViewModels;

namespace client_win.Modules.Chat.Views;

public partial class ChatView : UserControl
{
    private INotifyCollectionChanged? _currentMessages;
    private bool _didInitialFocus;

    public ChatView()
    {
        InitializeComponent();
        Loaded += (_, _) => InputBox.Focus();
    }

    private void OnRootPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape && DataContext is ChatViewModel vm && vm.CloseCommand.CanExecute(null))
        {
            vm.CloseCommand.Execute(null);
            e.Handled = true;
        }
    }

    private void OnInputKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && DataContext is ChatViewModel vm && vm.SendCommand.CanExecute(null))
        {
            vm.SendCommand.Execute(null);
            e.Handled = true;
        }
    }

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
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
            // ignore
        }
    }

    // IMPORTANT: on ne surcharge pas les flèches dans l'historique.
    // WPF + le lecteur d'écran gèrent mieux la lecture ligne par ligne sans interception.
}
