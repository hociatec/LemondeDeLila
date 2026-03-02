using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Views;

internal sealed class HistoryAnnouncerController : IGameHistoryAnnouncer
{
    private const int AnnouncementSpacingMs = 120;
    private readonly GameHistoryView _view;
    private readonly Queue<string> _pendingAnnouncements = new();
    private bool _announceScheduled;
    private int _announceRunId;
    private int _forceAssertiveAnnouncements;
    private IScreenReaderAnnouncer? _screenReader;
    private GameHistoryViewModel? _viewModel;

    public HistoryAnnouncerController(GameHistoryView view)
    {
        _view = view ?? throw new ArgumentNullException(nameof(view));
    }

    public void AttachViewModel(GameHistoryViewModel? viewModel)
    {
        if (_viewModel == viewModel)
        {
            return;
        }

        if (_viewModel != null && ReferenceEquals(_viewModel.Announcer, this))
        {
            _viewModel.Announcer = null;
        }

        _viewModel = viewModel;

        if (_viewModel != null)
        {
            _viewModel.Announcer = this;
        }
    }

    public void Reset()
    {
        ResetAnnouncements();
    }

    public void ClearViewModel()
    {
        if (_viewModel != null && ReferenceEquals(_viewModel.Announcer, this))
        {
            _viewModel.Announcer = null;
        }

        _viewModel = null;
    }

    public void SetScreenReader(IScreenReaderAnnouncer? screenReader)
    {
        _screenReader = screenReader;
    }

    public void NotifyUserInteraction()
    {
        _forceAssertiveAnnouncements = Math.Min(_forceAssertiveAnnouncements + 1, 3);
    }

    public void CancelPendingAnnouncements()
    {
        ResetAnnouncements();
    }

    public void CancelScreenReaderSpeech()
    {
        _screenReader?.CancelSpeech();
    }

    public void CollectAnnouncements(IEnumerable<string> entries)
    {
        if (!IsAppActive())
        {
            return;
        }

        if (_screenReader?.IsRunning == true)
        {
            return;
        }

        var added = entries
            .Where(s => !string.Equals(s, GameHistoryMessageSplitter.BlankLineToken, StringComparison.Ordinal))
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

    public void Announce(string message, bool assertive, bool flushPending)
    {
        if (flushPending)
        {
            ResetAnnouncements();
        }

        var normalized = NormalizeAnnouncement(message);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return;
        }

        if (UseDirectSpeech())
        {
            AnnounceDirect(normalized, assertive: assertive || ConsumeAssertiveFlag());
            return;
        }

        AnnounceLiveRegion(normalized, assertive || ConsumeAssertiveFlag());
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
            AnnounceQueuedMessage(message);

            try
            {
                await Task.Delay(AnnouncementSpacingMs).ConfigureAwait(true);
            }
            catch
            {
            }
        }

        if (runId == _announceRunId)
        {
            _announceScheduled = false;
        }
    }

    private void AnnounceQueuedMessage(string message)
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
        AnnounceLiveRegion(normalized, assertive);
    }

    private void AnnounceLiveRegion(string normalized, bool assertive)
    {
        try
        {
            var announcer = _view.A11yAnnouncer;
            AutomationProperties.SetLiveSetting(
                announcer,
                assertive ? AutomationLiveSetting.Assertive : AutomationLiveSetting.Polite);
            announcer.Text = normalized;
            AutomationProperties.SetName(announcer, normalized);
            var peer = FrameworkElementAutomationPeer.FromElement(announcer) ??
                       FrameworkElementAutomationPeer.CreatePeerForElement(announcer);
            peer?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
        }
        catch
        {
        }
    }

    private void AnnounceDirect(string message, bool assertive = false)
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

        if (assertive)
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
        return (message ?? string.Empty).Trim();
    }

    private bool UseDirectSpeech() => _screenReader?.IsRunning == true;

    private static bool IsAppActive()
    {
        try
        {
            var app = Application.Current;
            if (app == null)
            {
                return true;
            }

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

    private void ResetAnnouncements()
    {
        _pendingAnnouncements.Clear();
        _announceScheduled = false;
        _announceRunId++;
        AutomationProperties.SetName(_view.A11yAnnouncer, string.Empty);
        _view.A11yAnnouncer.Text = string.Empty;
    }
}
