using System;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Chat.ViewModels;

namespace client_win.Modules.Chat.Views;

public partial class ChatView : UserControl
{
    private INotifyCollectionChanged? _currentMessages;

    public ChatView()
    {
        InitializeComponent();
        Loaded += (_, _) => InputBox.Focus();
        Loaded += OnLoaded;
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
        if (DaysList != null)
        {
            DaysList.SelectionChanged += (_, _) => ScrollMessagesToEnd();
        }

        if (DataContext is ChatViewModel vm)
        {
            vm.PropertyChanged += (_, args) =>
            {
                if (args.PropertyName == nameof(ChatViewModel.SelectedDay) ||
                    args.PropertyName == nameof(ChatViewModel.SelectedMessages))
                {
                    AttachSelectedMessages(vm);
                    ScrollMessagesToEnd();
                }
            };

            AttachSelectedMessages(vm);
            ScrollMessagesToEnd();
        }
    }

    private void AttachSelectedMessages(ChatViewModel vm)
    {
        if (_currentMessages != null)
        {
            _currentMessages.CollectionChanged -= OnSelectedMessagesChanged;
            _currentMessages = null;
        }

        var selected = vm.SelectedMessages;
        if (selected is INotifyCollectionChanged coll)
        {
            _currentMessages = coll;
            coll.CollectionChanged += OnSelectedMessagesChanged;
        }
    }

    private void OnSelectedMessagesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        ScrollMessagesToEnd();
    }

    private void ScrollMessagesToEnd()
    {
        if (MessagesList == null)
        {
            return;
        }
        try
        {
            if (MessagesList.Items.Count > 0)
            {
                MessagesList.ScrollIntoView(MessagesList.Items[MessagesList.Items.Count - 1]);
            }
        }
        catch
        {
            // ignore
        }
    }

    // IMPORTANT: on ne surcharge pas les flèches dans l'historique.
    // WPF + le lecteur d'écran gèrent mieux la lecture ligne par ligne sans interception.
}
