using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Game.Common;
using client_win.Modules.Network.WebSockets;

namespace client_win.Modules.Game.Room.Services;

public sealed partial class RoomSession
{
    private sealed class RoomReconnectController
    {
        private readonly RoomSession _session;
        private Task? _loop;
        private int _reconnectRequested;
        private int _forceReconnectRequested;
        private int _reconnectAttempt;

        public RoomReconnectController(RoomSession session)
        {
            _session = session ?? throw new ArgumentNullException(nameof(session));
        }

        public Task? CurrentLoop => _loop;

        public void RequestReconnect(bool force)
        {
            if (_session._reconnectAsync == null) return;
            if (_session._lifetimeCts.IsCancellationRequested) return;

            Interlocked.Exchange(ref _reconnectRequested, 1);
            if (force)
            {
                Interlocked.Exchange(ref _forceReconnectRequested, 1);
            }

            if (_loop != null && !_loop.IsCompleted)
            {
                return;
            }

            _loop = Task.Run(() => RunLoopAsync(_session._lifetimeCts.Token));
        }

        public void ResetAttempt()
        {
            _reconnectAttempt = 0;
        }

        private async Task RunLoopAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var want = Interlocked.CompareExchange(ref _reconnectRequested, 0, 1) == 1;
                var force = Interlocked.CompareExchange(ref _forceReconnectRequested, 0, 1) == 1;
                if (!want && !force)
                {
                    return;
                }

                if (!force && _session._state == WebSocketState.Connected)
                {
                    return;
                }

                _reconnectAttempt = Math.Min(_reconnectAttempt + 1, 12);
                var delay = ComputeBackoff(_reconnectAttempt);
                try
                {
                    await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
                }
                catch
                {
                    return;
                }

                try
                {
                    using var timeout = new CancellationTokenSource(GameTiming.Room.ReconnectAttemptTimeout);
                    using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

                    await _session._reconnectAsync!(_session._socket, linked.Token).ConfigureAwait(false);
                    await _session.EnsureJoinedAsync(linked.Token).ConfigureAwait(false);

                    _reconnectAttempt = 0;
                    return;
                }
                catch (Exception ex)
                {
                    var message = (ex.Message ?? string.Empty).Trim();
                    if (!string.IsNullOrWhiteSpace(message))
                    {
                        try { _session.ErrorReceived?.Invoke(message); } catch { }
                    }

                    if (IsFatalReconnectError(message))
                    {
                        try { _session.Left?.Invoke(WsMessageTypes.Room.Deleted); } catch { }
                        return;
                    }

                    Interlocked.Exchange(ref _reconnectRequested, 1);
                }
            }
        }
    }
}

