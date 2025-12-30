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
    private DispatcherTimer? _announceTimer;
    private string _pendingAnnouncement = string.Empty;
    private string? _lastAnnounced;
    private DateTime _lastAnnouncedAtUtc;

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
            return;
        }

        StopAnnouncements();
        HistoryEditor.Clear();
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

                if (added.Count == 1)
                {
                    SetPendingAnnouncement(added[0]);
                }
                else if (added.Count > 1)
                {
                    // Regroupe un burst : annonces temps réel (pas de backlog),
                    // on privilégie le "plus récent" sans faire une file infinie.
                    SetPendingAnnouncement(string.Join(Environment.NewLine, added));
                }
            }
            return;
        }

        ScheduleRebuild(scrollToEnd: false);
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

    private void SetPendingAnnouncement(string message)
    {
        var cleaned = (message ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return;
        }

        // Coalescing: si plusieurs messages arrivent très vite, on les regroupe mais on limite
        // pour rester "temps réel" et éviter de lire 20 lignes en retard.
        if (string.IsNullOrWhiteSpace(_pendingAnnouncement))
        {
            _pendingAnnouncement = cleaned;
        }
        else
        {
            _pendingAnnouncement = $"{_pendingAnnouncement}{Environment.NewLine}{cleaned}";
        }

        const int maxChars = 700;
        if (_pendingAnnouncement.Length > maxChars)
        {
            _pendingAnnouncement = _pendingAnnouncement.Substring(_pendingAnnouncement.Length - maxChars);
        }

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

        _announceTimer = new DispatcherTimer(DispatcherPriority.Background, Dispatcher)
        {
            Interval = TimeSpan.FromMilliseconds(150),
        };
        _announceTimer.Tick += (_, __) => PumpAnnouncement();
        _announceTimer.Start();
    }

    private void PumpAnnouncement()
    {
        if (string.IsNullOrWhiteSpace(_pendingAnnouncement))
        {
            StopAnnouncements();
            return;
        }

        // Si l'utilisateur est en train de lire l'historique, ne pas interrompre.
        if (HistoryEditor.IsKeyboardFocusWithin)
        {
            return;
        }

        var next = _pendingAnnouncement.Trim();
        _pendingAnnouncement = string.Empty;
        var now = DateTime.UtcNow;

        // Anti-spam : ignore un doublon strict très rapproché (ex: "Table démarrée." répété).
        if (string.Equals(_lastAnnounced, next, StringComparison.Ordinal) &&
            (now - _lastAnnouncedAtUtc) < TimeSpan.FromSeconds(1))
        {
            return;
        }
        _lastAnnounced = next;
        _lastAnnouncedAtUtc = now;

        try
        {
            var peer = FrameworkElementAutomationPeer.FromElement(this) ??
                       FrameworkElementAutomationPeer.CreatePeerForElement(this);
            peer?.RaiseNotificationEvent(
                AutomationNotificationKind.Other,
                // MostRecent: comportement "temps réel" (on privilégie la dernière info).
                AutomationNotificationProcessing.MostRecent,
                next,
                "GameHistory");
        }
        catch
        {
            // ignore (best-effort)
        }
    }

    private void StopAnnouncements()
    {
        _pendingAnnouncement = string.Empty;
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
