using System;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Chat.ViewModels;

namespace client_win.Modules.Chat.Views;

public partial class ChatView : UserControl
{
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
        if (DataContext is ChatViewModel vm && vm.Messages is INotifyCollectionChanged coll)
        {
            coll.CollectionChanged += (_, _) => HistoryBox?.ScrollToEnd();
        }

        if (DataContext is INotifyPropertyChanged npc)
        {
            npc.PropertyChanged += (_, args) =>
            {
                if (args.PropertyName == nameof(ChatViewModel.HistoryText))
                {
                    HistoryBox?.ScrollToEnd();
                }
            };
        }
    }

    // IMPORTANT: on ne surcharge pas les flèches dans l'historique.
    // WPF + le lecteur d'écran gèrent mieux la lecture ligne par ligne sans interception.
}
