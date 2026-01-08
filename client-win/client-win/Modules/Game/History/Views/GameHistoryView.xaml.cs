using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Views;

public partial class GameHistoryView : UserControl
{
    private GameHistoryViewModel? _viewModel;
    private bool _pendingRebuild;
    private const int AnnouncementSpacingMs = 200;
    private readonly Queue<string> _pendingAnnouncements = new();
    private bool _announceScheduled;
    private int _announceRunId;
    private int _forceAssertiveAnnouncements;
    private IScreenReaderAnnouncer? _screenReader;

    public GameHistoryView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
        HistoryViewer.GotKeyboardFocus += OnHistoryGotKeyboardFocus;
    }

    public FrameworkElement? FocusTarget => HistoryViewer;

    public void FocusToBottom()
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            MoveCaretAndScrollToEnd();
            HistoryViewer.Focus();
            Keyboard.Focus(HistoryViewer);
        }));
    }

    public void SetScreenReader(IScreenReaderAnnouncer? screenReader)
    {
        _screenReader = screenReader;
    }

    public void NotifyUserInteraction()
    {
        _forceAssertiveAnnouncements = Math.Min(_forceAssertiveAnnouncements + 1, 3);
    }

    public void CancelPendingAnnouncementsFromHost()
    {
        ResetAnnouncements();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as GameHistoryViewModel);
        AttachAppActivationHooks();

        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (!HistoryViewer.IsKeyboardFocusWithin)
            {
                MoveCaretAndScrollToEnd();
            }
        }));
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(null);
        DetachAppActivationHooks();
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

        ResetAnnouncements();
        _forceAssertiveAnnouncements = 0;
        HistoryViewer.Document.Blocks.Clear();
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
            return;
        }

        ScheduleRebuild(scrollToEnd: false);
    }

    private void AppendEntries(IEnumerable<string> entries)
    {
        foreach (var entry in entries.Where(s => !string.IsNullOrWhiteSpace(s)))
        {
            HistoryViewer.Document.Blocks.Add(new Paragraph(new Run(entry)));
        }

        if (!HistoryViewer.IsKeyboardFocusWithin)
        {
            MoveCaretAndScrollToEnd();
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

        HistoryViewer.Document.Blocks.Clear();
        foreach (var entry in _viewModel.Entries.Where(s => !string.IsNullOrEmpty(s)))
        {
            HistoryViewer.Document.Blocks.Add(new Paragraph(new Run(entry)));
        }

        if (scrollToEnd && !HistoryViewer.IsKeyboardFocusWithin)
        {
            MoveCaretAndScrollToEnd();
        }
    }

    private void OnHistoryGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        // UX: quand on entre dans l'historique (Tab depuis la zone de jeu, clic, etc.),
        // se placer automatiquement sur la dernière ligne.
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(MoveCaretAndScrollToEnd));
    }

    private void MoveCaretAndScrollToEnd()
    {
        try
        {
            var end = HistoryViewer.Document?.ContentEnd;
            if (end != null)
            {
                HistoryViewer.CaretPosition = end;
            }
        }
        catch
        {
            // Best-effort
        }

        try
        {
            HistoryViewer.ScrollToEnd();
        }
        catch
        {
            // Best-effort
        }
    }

    private void CollectAnnouncements(IEnumerable<string> entries)
    {
        if (!IsAppActive())
        {
            return;
        }

        // Si on a un annonceur direct (NVDA), l’annonce est gérée en amont (GameHistorySink) pour garantir
        // que chaque ligne est lue. Éviter toute annonce en double ici.
        if (_screenReader?.IsRunning == true)
        {
            return;
        }

        var added = entries
            .Select(s => (s ?? string.Empty).Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

        if (added.Count == 0)
        {
            return;
        }

        if (UseDirectSpeech())
        {
            foreach (var line in added)
            {
                AnnounceDirect(line);
            }
            return;
        }

        foreach (var line in added)
        {
            _pendingAnnouncements.Enqueue(line);
        }
        ScheduleAnnouncement();
    }

    private void ResetAnnouncements()
    {
        _pendingAnnouncements.Clear();
        _announceScheduled = false;
        _announceRunId++;
        A11yAnnouncer.Text = string.Empty;
        AutomationProperties.SetName(A11yAnnouncer, string.Empty);
    }

    private void ScheduleAnnouncement()
    {
        if (_announceScheduled)
        {
            return;
        }

        _announceScheduled = true;
        var runId = ++_announceRunId;
        _ = RunAnnouncementsAsync(runId);
    }

    private async Task RunAnnouncementsAsync(int runId)
    {
        while (runId == _announceRunId)
        {
            if (_pendingAnnouncements.Count == 0)
            {
                break;
            }

            var message = _pendingAnnouncements.Dequeue();
            Announce(message);

            try
            {
                await Task.Delay(AnnouncementSpacingMs).ConfigureAwait(true);
            }
            catch
            {
                // Best-effort.
            }
        }

        if (runId == _announceRunId)
        {
            _announceScheduled = false;
        }
    }

    private void Announce(string message)
    {
        if (!IsAppActive())
        {
            return;
        }

        var normalized = NormalizeAnnouncement(message);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return;
        }

        var assertive = ConsumeAssertiveFlag();

        try
        {
            AutomationProperties.SetLiveSetting(
                A11yAnnouncer,
                assertive ? AutomationLiveSetting.Assertive : AutomationLiveSetting.Polite);
            A11yAnnouncer.Text = normalized;
            AutomationProperties.SetName(A11yAnnouncer, normalized);
            var peer = FrameworkElementAutomationPeer.FromElement(A11yAnnouncer) ??
                       FrameworkElementAutomationPeer.CreatePeerForElement(A11yAnnouncer);
            peer?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
        }
        catch
        {
            // Best-effort.
        }
    }

    private void AnnounceDirect(string message)
    {
        if (!IsAppActive())
        {
            return;
        }

        if (_screenReader == null || _screenReader.IsRunning != true)
        {
            return;
        }

        var normalized = NormalizeAnnouncement(message);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return;
        }

        if (ConsumeAssertiveFlag())
        {
            _screenReader.AnnounceAssertive(normalized);
            return;
        }

        _screenReader.AnnouncePolite(normalized);
    }

    private bool ConsumeAssertiveFlag()
    {
        if (_forceAssertiveAnnouncements <= 0)
        {
            return false;
        }

        _forceAssertiveAnnouncements = Math.Max(0, _forceAssertiveAnnouncements - 1);
        return true;
    }

    private static string NormalizeAnnouncement(string message)
    {
        var trimmed = (message ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return string.Empty;
        }
        return trimmed;
    }

    private bool UseDirectSpeech() => _screenReader?.IsRunning == true;

    private void AttachAppActivationHooks()
    {
        try
        {
            if (Application.Current == null) return;
            Application.Current.Deactivated -= OnAppDeactivated;
            Application.Current.Deactivated += OnAppDeactivated;
        }
        catch
        {
            // ignore
        }
    }

    private void DetachAppActivationHooks()
    {
        try
        {
            if (Application.Current == null) return;
            Application.Current.Deactivated -= OnAppDeactivated;
        }
        catch
        {
            // ignore
        }
    }

    private void OnAppDeactivated(object? sender, EventArgs e)
    {
        CancelPendingAnnouncementsFromHost();
        _screenReader?.CancelSpeech();
    }

    private static bool IsAppActive()
    {
        try
        {
            var app = Application.Current;
            if (app == null) return true;
            foreach (var window in app.Windows)
            {
                if (window is Window w && w.IsActive)
                {
                    return true;
                }
            }
            return app.MainWindow == null;
        }
        catch
        {
            return true;
        }
    }

}
