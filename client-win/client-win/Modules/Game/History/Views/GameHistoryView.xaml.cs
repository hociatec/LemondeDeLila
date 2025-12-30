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
    private DispatcherTimer? _announceTimer;
    private readonly Queue<string> _announceQueue = new();

    public GameHistoryView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
    }

    public FrameworkElement? FocusTarget => HistoryEditor;

    public event EventHandler<TabNavigationRequestedEventArgs>? TabNavigationRequested;

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

            // Cas important: certains messages (ex: "Table créée...") sont ajoutés avant que la vue
            // ne soit chargée et donc avant l'abonnement à CollectionChanged.
            // On annonce les dernières lignes existantes à l'attache.
            if (!HistoryEditor.IsKeyboardFocusWithin && _viewModel.Entries.Count > 0)
            {
                var startIndex = Math.Max(0, _viewModel.Entries.Count - 5);
                for (var i = startIndex; i < _viewModel.Entries.Count; i++)
                {
                    var line = (_viewModel.Entries[i] ?? string.Empty).Trim();
                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        EnqueueAnnouncement(line);
                    }
                }
            }
            return;
        }

        HistoryEditor.Clear();
        _lastKnownEntryCount = 0;
        StopAnnouncePump(clearQueue: true);
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

            // Annoncer uniquement ce qui vient d'être ajouté (et pas tout le texte),
            // en séquençant pour éviter que le lecteur d'écran ne "coupe" des messages en rafale.
            if (!HistoryEditor.IsKeyboardFocusWithin)
            {
                var added = e.NewItems
                    .Cast<string>()
                    .Select(s => (s ?? string.Empty).Trim())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToList();

                if (added.Count > 0)
                {
                    foreach (var msg in added.SelectMany(SplitLines))
                    {
                        EnqueueAnnouncement(msg);
                    }
                }
            }

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

    private void EnqueueAnnouncement(string message)
    {
        var cleaned = (message ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return;
        }

        // Si l'utilisateur est en train de lire l'historique, ne pas interrompre.
        if (HistoryEditor.IsKeyboardFocusWithin)
        {
            return;
        }

        _announceQueue.Enqueue(cleaned);
        EnsureAnnouncePump();
    }

    private void EnsureAnnouncePump()
    {
        if (_announceTimer != null)
        {
            if (!_announceTimer.IsEnabled)
            {
                _announceTimer.Start();
            }
            return;
        }

        // Sans anti-rafale/coalescing: on séquence juste les notifications pour éviter que certains lecteurs d'écran
        // en "ratent" quand plusieurs events UIA partent trop vite.
        _announceTimer = new DispatcherTimer(DispatcherPriority.Background, Dispatcher)
        {
            Interval = TimeSpan.FromMilliseconds(80),
        };
        _announceTimer.Tick += (_, __) => PumpAnnouncements();
        _announceTimer.Start();
    }

    private void PumpAnnouncements()
    {
        if (_announceQueue.Count == 0)
        {
            StopAnnouncePump(clearQueue: false);
            return;
        }

        // Si l'utilisateur est en train de lire l'historique, ne pas interrompre (et ne pas backlogger).
        if (HistoryEditor.IsKeyboardFocusWithin)
        {
            StopAnnouncePump(clearQueue: true);
            return;
        }

        var next = _announceQueue.Dequeue();
        try
        {
            var peer = FrameworkElementAutomationPeer.FromElement(this) ??
                       FrameworkElementAutomationPeer.CreatePeerForElement(this);
            peer?.RaiseNotificationEvent(
                AutomationNotificationKind.Other,
                AutomationNotificationProcessing.All,
                next,
                "GameHistory");
        }
        catch
        {
            // ignore (best-effort)
        }
    }

    private void StopAnnouncePump(bool clearQueue)
    {
        if (clearQueue)
        {
            _announceQueue.Clear();
        }

        if (_announceTimer != null)
        {
            _announceTimer.Stop();
            _announceTimer = null;
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
