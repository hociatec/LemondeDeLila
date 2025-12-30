using System;
using System.Windows;
using client_win.Modules.Chat.ViewModels;
using System.Collections.Specialized;
using System.Windows.Controls;
using System.ComponentModel;
using System.Windows.Input;
using System.Windows.Media;

namespace client_win.Modules.Chat.Views;

public partial class ChatWindow : Window
{
    private INotifyCollectionChanged? _currentItems;
    private ScrollViewer? _scrollViewer;
    private bool _stickToBottom = true;
    private bool _didInitialPositioning;

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
        if (DataContext is ChatViewModel vm)
        {
            AttachItems(vm);
        }

        _scrollViewer = FindDescendantScrollViewer(MessagesList);
        if (_scrollViewer != null)
        {
            _scrollViewer.ScrollChanged += (_, _) =>
            {
                _stickToBottom = IsNearBottom(_scrollViewer);
            };
        }

        PositionToBottom(force: true);
    }

    private void AttachItems(ChatViewModel vm)
    {
        if (_currentItems != null)
        {
            _currentItems.CollectionChanged -= OnItemsChanged;
            _currentItems = null;
        }

        if (vm.Items is INotifyCollectionChanged coll)
        {
            _currentItems = coll;
            coll.CollectionChanged += OnItemsChanged;
        }
    }

    private void OnItemsChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        PositionToBottom(force: false);
    }

    private void PositionToBottom(bool force)
    {
        if (MessagesList == null)
        {
            return;
        }

        if (!_didInitialPositioning)
        {
            force = true;
            _didInitialPositioning = true;
        }

        if (!force && !_stickToBottom)
        {
            return;
        }

        try
        {
            if (MessagesList.Items.Count > 0)
            {
                var last = MessagesList.Items[MessagesList.Items.Count - 1];
                MessagesList.ScrollIntoView(last);
                MessagesList.SelectedItem = last;
            }
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
