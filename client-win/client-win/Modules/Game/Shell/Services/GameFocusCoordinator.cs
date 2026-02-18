using System;
using System.Threading;
using System.Windows.Threading;
using Serilog;

namespace client_win.Modules.Game.Shell.Services;

public sealed class GameFocusCoordinator : IGameFocusCoordinator
{
    private static readonly bool TraceEnabled = IsTraceEnabled();

    private readonly Dispatcher _dispatcher;
    private readonly object _gate = new();
    private IGameFocusHost? _host;
    private int _requestId;
    private int _completedRequestId;

    public GameFocusCoordinator(Dispatcher dispatcher)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
    }

    public IDisposable AttachHost(IGameFocusHost host)
    {
        if (host == null) throw new ArgumentNullException(nameof(host));

        lock (_gate)
        {
            _host = host;
        }

        return new Lease(this, host);
    }

    public void RequestGameZone(GameFocusReason reason = GameFocusReason.Default)
    {
        var requestId = Interlocked.Increment(ref _requestId);
        TryLogDebug("focus.request id={RequestId} reason={Reason}", requestId, reason);
        QueueAttempt(requestId, reason, DispatcherPriority.Input, activate: true);
        QueueAttempt(requestId, reason, DispatcherPriority.Loaded, activate: false);
        QueueAttempt(requestId, reason, DispatcherPriority.ApplicationIdle, activate: false);
    }

    private void QueueAttempt(int requestId, GameFocusReason reason, DispatcherPriority priority, bool activate)
    {
        _ = _dispatcher.BeginInvoke(priority, new Action(() =>
        {
            if (requestId <= Volatile.Read(ref _completedRequestId))
            {
                TryLogDebug("focus.skip id={RequestId} reason={Reason} priority={Priority} completed=true", requestId, reason, priority);
                return;
            }

            if (requestId != _requestId)
            {
                TryLogDebug("focus.skip id={RequestId} reason={Reason} priority={Priority} stale=true", requestId, reason, priority);
                return;
            }

            IGameFocusHost? host;
            lock (_gate)
            {
                host = _host;
            }

            if (host == null)
            {
                TryLogDebug("focus.skip id={RequestId} reason={Reason} priority={Priority} host=none", requestId, reason, priority);
                return;
            }

            if (activate)
            {
                host.ActivateWindow();
            }

            var result = host.FocusGameZone(reason);
            TryLogDebug(
                "focus.attempt id={RequestId} reason={Reason} priority={Priority} activate={Activate} result={Result}",
                requestId,
                reason,
                priority,
                activate,
                result);
            if (IsSatisfied(reason, result))
            {
                Interlocked.Exchange(ref _completedRequestId, requestId);
                TryLogDebug("focus.done id={RequestId} reason={Reason} priority={Priority} result={Result}", requestId, reason, priority, result);
                return;
            }
        }));
    }

    private static bool IsSatisfied(GameFocusReason reason, GameFocusAttemptResult result)
    {
        if (result == GameFocusAttemptResult.None)
        {
            return false;
        }

        if (reason is GameFocusReason.TableStarted or GameFocusReason.GamePlayReady or GameFocusReason.ChoosePawn)
        {
            return result == GameFocusAttemptResult.Interactive;
        }

        return true;
    }

    private static bool IsTraceEnabled()
    {
        var raw = (Environment.GetEnvironmentVariable("LILA_FOCUS_LOGS") ?? string.Empty).Trim();
        if (raw.Length == 0)
        {
            return false;
        }

        if (bool.TryParse(raw, out var enabled))
        {
            return enabled;
        }

        return string.Equals(raw, "1", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(raw, "on", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(raw, "yes", StringComparison.OrdinalIgnoreCase);
    }

    private static void TryLogDebug(string messageTemplate, params object[] values)
    {
        if (!TraceEnabled)
        {
            return;
        }

        Log.Debug(messageTemplate, values);
    }

    private void Detach(IGameFocusHost host)
    {
        lock (_gate)
        {
            if (ReferenceEquals(_host, host))
            {
                _host = null;
            }
        }
    }

    private sealed class Lease : IDisposable
    {
        private readonly GameFocusCoordinator _owner;
        private readonly IGameFocusHost _host;
        private int _disposed;

        public Lease(GameFocusCoordinator owner, IGameFocusHost host)
        {
            _owner = owner;
            _host = host;
        }

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) == 1)
            {
                return;
            }

            _owner.Detach(_host);
        }
    }
}
