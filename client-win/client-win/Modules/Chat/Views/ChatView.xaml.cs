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

    private void OnHistoryPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (HistoryBox == null || sender != HistoryBox)
        {
            return;
        }

        if (e.Key == Key.Up)
        {
            MoveCaretLine(-1);
            e.Handled = true;
        }
        else if (e.Key == Key.Down)
        {
            MoveCaretLine(1);
            e.Handled = true;
        }
        else if (e.Key == Key.Home && Keyboard.Modifiers.HasFlag(ModifierKeys.Control))
        {
            MoveCaretToBoundary(isStart: true);
            e.Handled = true;
        }
        else if (e.Key == Key.End && Keyboard.Modifiers.HasFlag(ModifierKeys.Control))
        {
            MoveCaretToBoundary(isStart: false);
            e.Handled = true;
        }
    }

    private void MoveCaretLine(int offset)
    {
        if (HistoryBox == null)
        {
            return;
        }

        int currentLine = HistoryBox.GetLineIndexFromCharacterIndex(HistoryBox.CaretIndex);
        int targetLine = Math.Clamp(currentLine + offset, 0, Math.Max(0, HistoryBox.LineCount - 1));
        int targetIndex = HistoryBox.GetCharacterIndexFromLineIndex(targetLine);
        HistoryBox.CaretIndex = targetIndex;
        HistoryBox.ScrollToLine(targetLine);
    }

    private void MoveCaretToBoundary(bool isStart)
    {
        if (HistoryBox == null || HistoryBox.LineCount == 0)
        {
            return;
        }

        int targetLine = isStart ? 0 : HistoryBox.LineCount - 1;
        int targetIndex = HistoryBox.GetCharacterIndexFromLineIndex(targetLine);
        HistoryBox.CaretIndex = targetIndex;
        HistoryBox.ScrollToLine(targetLine);
    }
}
