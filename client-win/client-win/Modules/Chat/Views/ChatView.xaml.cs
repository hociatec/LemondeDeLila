using System;
using System.Collections.Specialized;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using client_win.Modules.Chat.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Chat.Views;

public partial class ChatView : UserControl, IInitialFocusTarget
{
    private INotifyCollectionChanged? _currentMessages;
    private bool _didInitialFocus;
    private ScrollViewer? _historyScroll;
    private bool _stickToBottom = true;

    private double? _pendingRestoreHistoryOffset;
    private int? _pendingRestoreCaretIndex;
    private int? _pendingRestoreSelectionStart;
    private int? _pendingRestoreSelectionLength;

    public ChatView()
    {
        InitializeComponent();
        HistoryBox.GotKeyboardFocus += (_, _) =>
        {
            _stickToBottom = true;
            ScrollHistoryToEnd(force: true);
        };
        Loaded += (_, _) => InputBox.Focus();
    }

    private void OnRootPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape && DataContext is ChatViewModel vm && vm.CloseCommand.CanExecute(null))
        {
            e.Handled = true;
            _ = Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    if (vm.CloseCommand.CanExecute(null))
                    {
                        vm.CloseCommand.Execute(null);
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
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

        _historyScroll = FindDescendantScrollViewer(HistoryBox);
        if (_historyScroll != null)
        {
            _historyScroll.ScrollChanged += (_, _) => { _stickToBottom = IsNearBottom(_historyScroll); };
        }

        if (!_didInitialFocus)
        {
            _didInitialFocus = true;
            ScrollHistoryToEnd(force: true);
        }
    }

    private void OnMessagesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        // If the user is currently reading the history (scrolled up), do NOT move their focus/caret.
        // Updating the bound Text can cause WPF to reset the scroll position; we restore it best-effort.
        if (!_stickToBottom && HistoryBox?.IsKeyboardFocusWithin == true && _historyScroll != null)
        {
            _pendingRestoreHistoryOffset = _historyScroll.VerticalOffset;
            _pendingRestoreCaretIndex = HistoryBox.CaretIndex;
            _pendingRestoreSelectionStart = HistoryBox.SelectionStart;
            _pendingRestoreSelectionLength = HistoryBox.SelectionLength;

            Dispatcher.BeginInvoke(() =>
            {
                if (_stickToBottom || HistoryBox?.IsKeyboardFocusWithin != true || _historyScroll == null)
                {
                    ClearPendingHistoryRestore();
                    return;
                }

                try
                {
                    var textLen = HistoryBox.Text?.Length ?? 0;
                    var caret = Math.Clamp(_pendingRestoreCaretIndex ?? 0, 0, textLen);
                    var selStart = Math.Clamp(_pendingRestoreSelectionStart ?? caret, 0, textLen);
                    var selLen = Math.Clamp(_pendingRestoreSelectionLength ?? 0, 0, Math.Max(0, textLen - selStart));

                    HistoryBox.SelectionStart = selStart;
                    HistoryBox.SelectionLength = selLen;
                    HistoryBox.CaretIndex = caret;

                    var offset = _pendingRestoreHistoryOffset ?? 0;
                    _historyScroll.ScrollToVerticalOffset(offset);
                }
                catch
                {
                    // best-effort
                }
                finally
                {
                    ClearPendingHistoryRestore();
                }
            }, System.Windows.Threading.DispatcherPriority.Background);

            return;
        }

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

    private void ClearPendingHistoryRestore()
    {
        _pendingRestoreHistoryOffset = null;
        _pendingRestoreCaretIndex = null;
        _pendingRestoreSelectionStart = null;
        _pendingRestoreSelectionLength = null;
    }

    private async void OnHistoryKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && DataContext is ChatViewModel vm)
        {
            var caret = HistoryBox?.CaretIndex ?? 0;
            var res = await vm.HandleHistoryActionAsync(caret);
            if (!res.Handled)
            {
                return;
            }
            if (res.StartedEdit)
            {
                FocusInputDeferred(selectAll: true);
            }
            e.Handled = true;
        }
    }

    private void FocusInputDeferred(bool selectAll)
    {
        if (InputBox == null)
        {
            return;
        }

        void FocusNow()
        {
            try
            {
                InputBox.Focus();
                Keyboard.Focus(InputBox);
                if (selectAll)
                {
                    InputBox.SelectAll();
                }
            }
            catch
            {
                // best-effort
            }
        }

        Dispatcher.BeginInvoke(FocusNow, System.Windows.Threading.DispatcherPriority.Input);
        Dispatcher.BeginInvoke(FocusNow, System.Windows.Threading.DispatcherPriority.ApplicationIdle);
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

    public void RequestInitialFocus()
    {
        FocusInputDeferred(selectAll: false);
    }
}
