using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.User.Services;
using Serilog;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Shell.Room;

public sealed partial class RoomGatewayClient
{
    private sealed class WarmSocketPool
    {
        private readonly RoomGatewayClient _owner;
        private readonly ClientConfiguration _config;
        private readonly ISessionService _session;
        private readonly Func<IWebSocketConnection> _socketFactory;
        private readonly IWsTicketProvider _tickets;
        private readonly SemaphoreSlim _warmGate = new(1, 1);
        private IWebSocketConnection? _warmSocket;
        private DateTime _warmConnectedAtUtc = DateTime.MinValue;

        public WarmSocketPool(
            RoomGatewayClient owner,
            ClientConfiguration config,
            ISessionService session,
            Func<IWebSocketConnection> socketFactory,
            IWsTicketProvider tickets)
        {
            _owner = owner ?? throw new ArgumentNullException(nameof(owner));
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _session = session ?? throw new ArgumentNullException(nameof(session));
            _socketFactory = socketFactory ?? throw new ArgumentNullException(nameof(socketFactory));
            _tickets = tickets ?? throw new ArgumentNullException(nameof(tickets));
        }

        public async Task WarmUpAsync(CancellationToken cancellationToken)
        {
            var user = _session.CurrentUser;
            var token = user?.Token;
            if (string.IsNullOrWhiteSpace(token))
            {
                return;
            }

            if (!await _warmGate.WaitAsync(0, cancellationToken).ConfigureAwait(false))
            {
                return;
            }

            try
            {
                if (_warmSocket != null && _warmConnectedAtUtc != DateTime.MinValue)
                {
                    return;
                }

                var uri = BuildRoomUri(_config.RealtimeGatewayWs, roomId: 0);
                var headers = await _owner.BuildHeadersAsync(cancellationToken).ConfigureAwait(false);

                var socket = _socketFactory();
                var startedAt = DateTime.UtcNow;
                try
                {
                    Log.Information("WS room.warmup: connexion à {Endpoint}", uri);
                    await socket.ConnectAsync(uri, token: token, headers: headers, cancellationToken: cancellationToken)
                        .ConfigureAwait(false);
                    _warmSocket = socket;
                    _warmConnectedAtUtc = DateTime.UtcNow;
                    Log.Information(
                        "WS room.warmup: connecté en {ElapsedMs}ms",
                        (DateTime.UtcNow - startedAt).TotalMilliseconds);
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "WS room.warmup: échec connexion.");
                    try { await socket.CloseAsync().ConfigureAwait(false); } catch { }
                    try { await socket.DisposeAsync().ConfigureAwait(false); } catch { }
                    _warmSocket = null;
                    _warmConnectedAtUtc = DateTime.MinValue;
                }
            }
            finally
            {
                _warmGate.Release();
            }
        }

        public async Task<(IWebSocketConnection socket, bool reusedWarm)> TakeOrCreateSocketAsync(
            string token,
            CancellationToken cancellationToken)
        {
            IWebSocketConnection? warm = null;
            if (await _warmGate.WaitAsync(0, cancellationToken).ConfigureAwait(false))
            {
                try
                {
                    warm = _warmSocket;
                    _warmSocket = null;
                    _warmConnectedAtUtc = DateTime.MinValue;
                }
                finally
                {
                    _warmGate.Release();
                }
            }

            if (warm != null)
            {
                if (warm.State is WebSocketState.Disconnected or WebSocketState.Error)
                {
                    try { await warm.CloseAsync().ConfigureAwait(false); } catch { }
                    try { await warm.DisposeAsync().ConfigureAwait(false); } catch { }
                }
                else
                {
                    Log.Information("WS room.connect: réutilisation socket warm.");
                    return (warm, true);
                }
            }

            var socket = _socketFactory();
            var uri = BuildRoomUri(_config.RealtimeGatewayWs, roomId: 0);

            var headersStartedAt = DateTime.UtcNow;
            var headers = await _owner.BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
            Log.Information(
                "WS room.connect: ticket+headers en {ElapsedMs}ms",
                (DateTime.UtcNow - headersStartedAt).TotalMilliseconds);

            var connectStartedAt = DateTime.UtcNow;
            Log.Information("WS room.connect: connexion à {Endpoint}", uri);
            await socket.ConnectAsync(uri, token: token, headers: headers, cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            Log.Information(
                "WS room.connect: handshake WS en {ElapsedMs}ms",
                (DateTime.UtcNow - connectStartedAt).TotalMilliseconds);

            return (socket, false);
        }

        public async Task ReturnWarmSocketAsync(IWebSocketConnection socket)
        {
            if (socket == null)
            {
                return;
            }

            if (socket.State is WebSocketState.Disconnected or WebSocketState.Error)
            {
                try { await socket.CloseAsync().ConfigureAwait(false); } catch { }
                try { await socket.DisposeAsync().ConfigureAwait(false); } catch { }
                return;
            }

            var shouldKeep = false;
            await _warmGate.WaitAsync().ConfigureAwait(false);
            try
            {
                if (_warmSocket == null)
                {
                    _warmSocket = socket;
                    _warmConnectedAtUtc = DateTime.UtcNow;
                    shouldKeep = true;
                }
            }
            finally
            {
                _warmGate.Release();
            }

            if (shouldKeep)
            {
                return;
            }

            Log.Warning("WS room: socket supplémentaire retourné; fermeture pour éviter une fuite.");
            try { await socket.CloseAsync().ConfigureAwait(false); } catch { }
            try { await socket.DisposeAsync().ConfigureAwait(false); } catch { }
        }
    }
}
