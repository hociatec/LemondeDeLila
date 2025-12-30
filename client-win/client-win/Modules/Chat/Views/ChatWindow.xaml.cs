using System;
using System.Windows;
using client_win.Modules.Chat.ViewModels;
using System.Collections.Specialized;
using System.Windows.Controls;
using System.ComponentModel;
using System.Windows.Input;

namespace client_win.Modules.Chat.Views;

public partial class ChatWindow : Window
{
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
                    ScrollMessagesToEnd();
                }
            };
        }

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
            // Best-effort: never crash the UI for a sound UX enhancement.
        }
    }

    // IMPORTANT: on ne surcharge pas les flèches dans les listes.
    // WPF + le lecteur d'écran gèrent mieux la lecture ligne par ligne sans interception.
}
