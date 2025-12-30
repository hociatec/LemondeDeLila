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
    private bool _historyFocusFromMouse;

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
        if (HistoryBox != null)
        {
            // If the user clicks in the history, don't override their caret position.
            HistoryBox.PreviewMouseDown += (_, _) => _historyFocusFromMouse = true;
            HistoryBox.GotKeyboardFocus += (_, _) =>
            {
                if (!_historyFocusFromMouse)
                {
                    ScrollHistoryToEnd();
                }
                _historyFocusFromMouse = false;
            };
        }

        if (DataContext is ChatViewModel vm && vm.Messages is INotifyCollectionChanged coll)
        {
            coll.CollectionChanged += (_, _) =>
            {
                ScrollHistoryToEnd();
            };
        }

        if (DataContext is INotifyPropertyChanged npc)
        {
            npc.PropertyChanged += (_, args) =>
            {
                if (args.PropertyName == nameof(ChatViewModel.HistoryText))
                {
                    ScrollHistoryToEnd();
                }
            };
        }

        // On open, keep the history scrolled to the newest messages (but keep input focused).
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
            // Keep the caret at the end so screen readers / arrow navigation start from the newest messages.
            var len = HistoryBox.Text?.Length ?? 0;
            HistoryBox.CaretIndex = len;
            HistoryBox.SelectionStart = len;
            HistoryBox.SelectionLength = 0;
            HistoryBox.ScrollToEnd();
        }
        catch
        {
            // Best-effort: never crash the UI for a sound UX enhancement.
        }
    }

    // IMPORTANT: on ne surcharge pas les flèches dans l'historique.
    // WPF + le lecteur d'écran gèrent mieux la lecture ligne par ligne sans interception.
}
