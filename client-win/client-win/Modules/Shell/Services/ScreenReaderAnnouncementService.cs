using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using client_win.Core.Text;

namespace client_win.Modules.Shell.Services;

public sealed class ScreenReaderAnnouncementService : IAnnouncementService
{
    private readonly IScreenReaderAnnouncer _announcer;
    private readonly Dispatcher _dispatcher;
    private readonly ILogger<ScreenReaderAnnouncementService> _logger;
    private readonly object _gate = new();
    private readonly Queue<(string Message, AnnouncementPriority Priority)> _queue = new();
    private bool _scheduled;
    private int _runId;
    private int _forceAssertive;
    private (string Message, long Ticks)? _lastSpoken;

    private static readonly TimeSpan Spacing = TimeSpan.FromMilliseconds(200);
    private static readonly long DedupWindowTicks = Stopwatch.Frequency; // ~1s

    public ScreenReaderAnnouncementService(
        IScreenReaderAnnouncer announcer,
        Dispatcher dispatcher,
        ILogger<ScreenReaderAnnouncementService> logger)
    {
        _announcer = announcer ?? throw new ArgumentNullException(nameof(announcer));
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public bool IsAvailable => _announcer.IsRunning;

    public void NotifyUserInteraction()
    {
        lock (_gate)
        {
            _forceAssertive = Math.Min(_forceAssertive + 1, 3);
        }
    }

    public void CancelPending(bool cancelSpeech = false)
    {
        lock (_gate)
        {
            _queue.Clear();
            _scheduled = false;
            _runId++;
        }

        if (cancelSpeech)
        {
            try { _announcer.CancelSpeech(); } catch { /* ignore */ }
        }
    }

    public void EnqueueMany(IEnumerable<string> messages, AnnouncementPriority priority = AnnouncementPriority.Polite)
    {
        if (messages == null)
        {
            return;
        }

        var list = messages
            .Select(m => MojibakeTextRepair.Fix(m).Trim())
            .Where(m => m.Length > 0)
            .ToList();
        if (list.Count == 0)
        {
            return;
        }

        lock (_gate)
        {
            foreach (var m in list)
            {
                _queue.Enqueue((m, priority));
            }
        }

        Schedule();
    }

    public void Enqueue(string message, AnnouncementPriority priority = AnnouncementPriority.Polite)
    {
        var trimmed = MojibakeTextRepair.Fix(message).Trim();
        if (trimmed.Length == 0)
        {
            return;
        }

        lock (_gate)
        {
            _queue.Enqueue((trimmed, priority));
        }

        Schedule();
    }

    private void Schedule()
    {
        if (!_announcer.IsRunning)
        {
            return;
        }

        lock (_gate)
        {
            if (_scheduled)
            {
                return;
            }

            _scheduled = true;
            _runId++;
            var runId = _runId;

            if (_dispatcher.CheckAccess())
            {
                _ = RunAsync(runId);
            }
            else
            {
                _ = _dispatcher.BeginInvoke(new Func<Task>(() => RunAsync(runId)), DispatcherPriority.Background);
            }
        }
    }

    private async Task RunAsync(int runId)
    {
        while (true)
        {
            (string Message, AnnouncementPriority Priority)? next = null;
            int forceAssertive;

            lock (_gate)
            {
                if (runId != _runId)
                {
                    return;
                }

                if (_queue.Count == 0)
                {
                    _scheduled = false;
                    return;
                }

                next = _queue.Dequeue();
                forceAssertive = _forceAssertive;
                if (_forceAssertive > 0)
                {
                    _forceAssertive = Math.Max(0, _forceAssertive - 1);
                }
            }

            if (next == null)
            {
                continue;
            }

            var (msg, prio) = next.Value;
            try
            {
                if (!_announcer.IsRunning)
                {
                    CancelPending(cancelSpeech: false);
                    return;
                }

                var effective = forceAssertive > 0 ? AnnouncementPriority.Assertive : prio;
                if (ShouldDedup(msg, effective))
                {
                    continue;
                }

                if (effective == AnnouncementPriority.Assertive)
                {
                    _announcer.AnnounceAssertive(msg);
                }
                else
                {
                    _announcer.AnnouncePolite(msg);
                }

                RememberSpoken(msg);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Annonce NVDA échouée");
            }

            try
            {
                await Task.Delay(Spacing).ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
        }
    }

    private bool ShouldDedup(string message, AnnouncementPriority priority)
    {
        if (priority == AnnouncementPriority.Assertive)
        {
            return false;
        }

        var now = Stopwatch.GetTimestamp();
        lock (_gate)
        {
            if (_lastSpoken is not { } last)
            {
                return false;
            }

            if (now - last.Ticks > DedupWindowTicks)
            {
                return false;
            }

            return string.Equals(last.Message, message, StringComparison.Ordinal);
        }
    }

    private void RememberSpoken(string message)
    {
        var now = Stopwatch.GetTimestamp();
        lock (_gate)
        {
            _lastSpoken = (message, now);
        }
    }
}
