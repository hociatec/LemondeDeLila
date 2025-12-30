using System;
using System.Windows;
using client_win.Modules.Chat.ViewModels;
using System.Collections.Specialized;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace client_win.Modules.Chat.Views;

public partial class ChatWindow : Window
{
    private INotifyCollectionChanged? _currentMessages;
    private bool _didInitialFocus;
    private ScrollViewer? _historyScroll;
    private bool _stickToBottom = true;

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

        _historyScroll = FindDescendantScrollViewer(HistoryBox);
        if (_historyScroll != null)
        {
            _historyScroll.ScrollChanged += (_, _) =>
            {
                _stickToBottom = IsNearBottom(_historyScroll);
            };
        }

        if (!_didInitialFocus)
        {
            _didInitialFocus = true;
            ScrollHistoryToEnd(force: true);
        }
    }

    private void OnMessagesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        ScrollHistoryToEnd(force: false);
    }

    private void ScrollHistoryToEnd(bool force)
    {
        if (HistoryBox == null)
        {
            return;
        }

        if (!force && !_stickToBottom)
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

    private static bool IsNearBottom(ScrollViewer sv)
    {
        if (sv.ScrollableHeight <= 0)
        {
            return true;
        }
        return sv.VerticalOffset >= sv.ScrollableHeight - 1.0;
    }

    private static ScrollViewer? FindDescendantScrollViewer(DependencyObject? root)
    {
        if (root == null)
        {
            return null;
        }

        if (root is ScrollViewer sv)
        {
            return sv;
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            var found = FindDescendantScrollViewer(child);
            if (found != null)
            {
                return found;
            }
        }

        return null;
    }

    // IMPORTANT: on ne surcharge pas les flèches dans les listes.
    // WPF + le lecteur d'écran gèrent mieux la lecture ligne par ligne sans interception.
}
