using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;

namespace client_win.Modules.Game.History.Views;

public partial class GameHistoryView : UserControl
{
    private GameHistoryViewModel? _viewModel;
    private bool _pendingRebuild;
    private int _lastKnownEntryCount;
    private readonly List<string> _pendingAnnouncements = new();
    private bool _announceScheduled;

    public GameHistoryView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
    }

    public FrameworkElement? FocusTarget => HistoryEditor;

    public event EventHandler<TabNavigationRequestedEventArgs>? TabNavigationRequested;

    public void CancelPendingAnnouncementsFromHost()
    {
        _pendingAnnouncements.Clear();
        _announceScheduled = false;
        A11yAnnouncer.Text = string.Empty;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as GameHistoryViewModel);

        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (!HistoryEditor.IsKeyboardFocusWithin)
            {
                HistoryEditor.ScrollToEnd();
            }
        }));
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(null);
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        AttachViewModel(e.NewValue as GameHistoryViewModel);
    }

    private void AttachViewModel(GameHistoryViewModel? next)
    {
        if (_viewModel == next)
        {
            return;
        }

        if (_viewModel != null)
        {
            _viewModel.Entries.CollectionChanged -= OnEntriesCollectionChanged;
        }

        _viewModel = next;

        if (_viewModel != null)
        {
            _viewModel.Entries.CollectionChanged += OnEntriesCollectionChanged;
            RebuildFromViewModel(scrollToEnd: true);
            _lastKnownEntryCount = _viewModel.Entries.Count;
            return;
        }

        _pendingAnnouncements.Clear();
        _announceScheduled = false;
        HistoryEditor.Clear();
        _lastKnownEntryCount = 0;
    }

    private void OnEntriesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (_viewModel == null)
        {
            return;
        }

        if (e.Action == NotifyCollectionChangedAction.Add && e.NewItems != null && e.NewItems.Count > 0)
        {
            AppendEntries(e.NewItems.Cast<string>());
            CollectAnnouncements(e.NewItems.Cast<string>());

            _lastKnownEntryCount = _viewModel.Entries.Count;
            return;
        }

        ScheduleRebuild(scrollToEnd: false);
        _lastKnownEntryCount = _viewModel.Entries.Count;
    }

    private void AppendEntries(IEnumerable<string> entries)
    {
        var shouldAutoScroll = ShouldAutoScrollToEnd();
        var preserveSelection = HistoryEditor.IsKeyboardFocusWithin && !shouldAutoScroll;

        var selectionStart = HistoryEditor.SelectionStart;
        var selectionLength = HistoryEditor.SelectionLength;
        var caretIndex = HistoryEditor.CaretIndex;

        foreach (var entry in entries.Where(s => !string.IsNullOrWhiteSpace(s)))
        {
            if (HistoryEditor.Text.Length > 0)
            {
                HistoryEditor.AppendText(Environment.NewLine);
            }

            HistoryEditor.AppendText(entry);
        }

        if (preserveSelection)
        {
            RestoreSelection(selectionStart, selectionLength, caretIndex);
            return;
        }

        if (shouldAutoScroll)
        {
            HistoryEditor.CaretIndex = HistoryEditor.Text.Length;
            HistoryEditor.ScrollToEnd();
        }
    }

    private void ScheduleRebuild(bool scrollToEnd)
    {
        if (_pendingRebuild)
        {
            return;
        }

        _pendingRebuild = true;
        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            _pendingRebuild = false;
            RebuildFromViewModel(scrollToEnd);
        }));
    }

    private void RebuildFromViewModel(bool scrollToEnd)
    {
        if (_viewModel == null)
        {
            return;
        }

        var shouldAutoScroll = scrollToEnd || ShouldAutoScrollToEnd();
        var preserveSelection = HistoryEditor.IsKeyboardFocusWithin && !shouldAutoScroll;

        var selectionStart = HistoryEditor.SelectionStart;
        var selectionLength = HistoryEditor.SelectionLength;
        var caretIndex = HistoryEditor.CaretIndex;

        HistoryEditor.Text = string.Join(Environment.NewLine, _viewModel.Entries.Where(s => !string.IsNullOrEmpty(s)));

        if (preserveSelection)
        {
            RestoreSelection(selectionStart, selectionLength, caretIndex);
            return;
        }

        if (shouldAutoScroll)
        {
            HistoryEditor.CaretIndex = HistoryEditor.Text.Length;
            HistoryEditor.ScrollToEnd();
        }
    }

    private void RestoreSelection(int selectionStart, int selectionLength, int caretIndex)
    {
        var textLength = HistoryEditor.Text.Length;
        var clampedStart = Math.Clamp(selectionStart, 0, textLength);
        var clampedLength = Math.Clamp(selectionLength, 0, Math.Max(0, textLength - clampedStart));
        var clampedCaret = Math.Clamp(caretIndex, 0, textLength);

        HistoryEditor.SelectionStart = clampedStart;
        HistoryEditor.SelectionLength = clampedLength;
        HistoryEditor.CaretIndex = clampedCaret;
    }

    private bool ShouldAutoScrollToEnd()
    {
        if (!HistoryEditor.IsKeyboardFocusWithin)
        {
            return true;
        }

        if (HistoryEditor.LineCount <= 0)
        {
            return true;
        }

        var lastVisibleLine = HistoryEditor.GetLastVisibleLineIndex();
        return lastVisibleLine >= HistoryEditor.LineCount - 1;
    }

    private void OnHistoryEditorPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Tab)
        {
            return;
        }

        e.Handled = true;

        var shift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
        TabNavigationRequested?.Invoke(this, new TabNavigationRequestedEventArgs(shift));
    }

    private static IEnumerable<string> SplitLines(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            yield break;
        }

        var normalized = message
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n');

        foreach (var raw in normalized.Split('\n'))
        {
            var cleaned = (raw ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(cleaned))
            {
                yield return cleaned;
            }
        }
    }

    private void CollectAnnouncements(IEnumerable<string> entries)
    {
        var added = entries
            .SelectMany(SplitLines)
            .Select(line => (line ?? string.Empty).Trim())
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();

        if (added.Count == 0)
        {
            return;
        }

        _pendingAnnouncements.AddRange(added);
        ScheduleAnnouncement();
    }

    private void ScheduleAnnouncement()
    {
        if (_announceScheduled)
        {
            return;
        }

        _announceScheduled = true;
        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(FlushAnnouncements));
    }

    private void FlushAnnouncements()
    {
        _announceScheduled = false;

        if (_pendingAnnouncements.Count == 0)
        {
            return;
        }

        var message = string.Join(Environment.NewLine, _pendingAnnouncements);
        _pendingAnnouncements.Clear();

        try
        {
            A11yAnnouncer.Text = message;
            AutomationProperties.SetName(A11yAnnouncer, message);
            var peer = FrameworkElementAutomationPeer.FromElement(A11yAnnouncer) ??
                       FrameworkElementAutomationPeer.CreatePeerForElement(A11yAnnouncer);
            peer?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
        }
        catch
        {
            // Best-effort.
        }
    }

}

public sealed class TabNavigationRequestedEventArgs : EventArgs
{
    public TabNavigationRequestedEventArgs(bool isShiftPressed)
    {
        IsShiftPressed = isShiftPressed;
    }

    public bool IsShiftPressed { get; }
}
