using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Common;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using Serilog;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed partial class RoomSession : IRoomSession
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly IWebSocketConnection _socket;
    private readonly Func<IWebSocketConnection, Task>? _returnSocketAsync;
    private readonly Func<IWebSocketConnection, CancellationToken, Task>? _reconnectAsync;
    private readonly bool _spectator;
    private readonly bool _silent;
    private readonly RoomConnectionSupervisor _supervisor;
    private readonly RoomReconnectController _reconnectController;
    private DateTime _lastPongUtc = DateTime.MinValue;
    private DateTime _lastStateRefreshUtc = DateTime.MinValue;
    private int _stateRefreshInFlight;

    private readonly CancellationTokenSource _lifetimeCts = new();
    private WebSocketState _state = WebSocketState.Connected;

    public RoomSession(
        int roomId,
        string gameType,
        IWebSocketConnection socket,
        Func<IWebSocketConnection, Task>? returnSocketAsync = null,
        Func<IWebSocketConnection, CancellationToken, Task>? reconnectAsync = null,
        bool spectator = false,
        bool silent = false)
    {
        RoomId = roomId;
        GameType = gameType ?? string.Empty;
        _socket = socket ?? throw new ArgumentNullException(nameof(socket));
        _returnSocketAsync = returnSocketAsync;
        _reconnectAsync = reconnectAsync;
        _spectator = spectator;
        _silent = silent;
        _state = socket.State;
        _socket.MessageReceived += OnRawMessage;
        _socket.StateChanged += OnStateChanged;
        _socket.Error += _ => { };

        _reconnectController = new RoomReconnectController(this);
        _supervisor = new RoomConnectionSupervisor(this);
    }

    public int RoomId { get; }
    public string GameType { get; }

    public RoomPayloadDto? LastRoomState { get; internal set; }

    public WebSocketState State => _state;

    public event Action<RoomPayloadDto>? RoomUpdated;
    public event Action<string>? RawMessageReceived;
    public event Action<string>? ErrorReceived;
    public event Action<string>? Left;
    public event Action<WebSocketState>? ConnectionStateChanged;

    public Task RequestStateRefreshAsync(bool force = false) =>
        _supervisor.RequestStateRefreshAsync(force);

    public async Task SendCommandAsync(string type, object? payload = null, CancellationToken cancellationToken = default)
    {
        _ = await SendCommandWithTraceAsync(type, payload, cancellationToken).ConfigureAwait(false);
    }

    public async Task<string> SendCommandWithTraceAsync(
        string type,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(type)) throw new ArgumentException("type requis", nameof(type));
        var traceId = Guid.NewGuid().ToString("N");
        var merged = ToDictionary(payload);
        merged["_trace"] = new
        {
            id = traceId,
            sentAtMs = ServerClock.NowServerMs()
        };
        var msg = JsonSerializer.Serialize(new { type, payload = merged }, _json);
        await _socket.SendAsync(msg, cancellationToken).ConfigureAwait(false);
        return traceId;
    }

    public Task<bool> SendCommandAwaitAckAsync(
        string type,
        object? payload = null,
        TimeSpan? ackTimeout = null,
        CancellationToken cancellationToken = default) =>
        _supervisor.SendCommandAwaitAckAsync(type, payload, ackTimeout, cancellationToken);

    public async Task LeaveAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var leave = JsonSerializer.Serialize(new { type = "room.leave", payload = new { } }, _json);
            await _socket.SendAsync(leave, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            // Best-effort.
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _supervisor.DisposeAsync().ConfigureAwait(false);
        try { _lifetimeCts.Cancel(); } catch { }
        _socket.MessageReceived -= OnRawMessage;
        _socket.StateChanged -= OnStateChanged;
        if (_returnSocketAsync != null)
        {
            await _returnSocketAsync(_socket).ConfigureAwait(false);
            return;
        }
        await _socket.DisposeAsync().ConfigureAwait(false);
    }

    private void OnStateChanged(WebSocketState state)
    {
        _state = state;
        try
        {
            ConnectionStateChanged?.Invoke(state);
        }
        catch
        {
            // Best-effort (ne pas casser la boucle WS si un handler client échoue).
        }

        _supervisor.HandleStateChanged(state);
    }

    private void OnRawMessage(string raw)
    {
        RawMessageReceived?.Invoke(raw);

        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp) ||
                typeProp.ValueKind != JsonValueKind.String)
            {
                return;
            }

            var type = typeProp.GetString() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(type))
            {
                return;
            }

            if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
            {
                HandleError(root);
                return;
            }

            if (string.Equals(type, "room.left", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(type, "room.deleted", StringComparison.OrdinalIgnoreCase))
            {
                // Sortie imposée (kick/ban/delete) OU table supprimée. La navigation est gérée par l'UI.
                Left?.Invoke(type);
                return;
            }

            if (string.Equals(type, "room.pong", StringComparison.OrdinalIgnoreCase))
            {
                _supervisor.HandlePong(root);
                return;
            }

            if (string.Equals(type, "room.ack", StringComparison.OrdinalIgnoreCase))
            {
                _supervisor.HandleCommandAck(root);
                return;
            }

            if (string.Equals(type, "state-updated", StringComparison.OrdinalIgnoreCase))
            {
                // Lightweight hint-only event. Real state updates are handled via room.updated.
                return;
            }

            if (string.Equals(type, "room.updated", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(type, "room.created", StringComparison.OrdinalIgnoreCase))
            {
                HandleRoomState(root);
            }
        }
        catch
        {
            // ignore
        }
    }

    private void HandleError(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("message", out var messageProp))
            {
                return;
            }

            var message = messageProp.GetString();
            if (string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            var trimmed = message.Trim();
            ErrorReceived?.Invoke(trimmed);
            if (IsFatalRoomError(trimmed))
            {
                // Ensure the UI exits the table if the room no longer exists.
                Left?.Invoke("room.deleted");
            }
        }
        catch
        {
            // ignore
        }
    }

    private static bool IsFatalRoomError(string message)
    {
        var normalized = message.Trim().ToLowerInvariant();
        if (normalized.Contains("introuvable") &&
            (normalized.Contains("table") || normalized.Contains("room")))
        {
            return true;
        }
        if (normalized.Contains("n'�tes pas dans une table") ||
            normalized.Contains("n��tes pas dans une table"))
        {
            return true;
        }
        return false;
    }

    private async Task RequestStateRefreshCoreAsync(bool force)
    {
        if (_state != WebSocketState.Connected)
        {
            return;
        }

        // Throttle to avoid spamming join messages on bursts.
        var now = DateTime.UtcNow;
        if (!force && _lastStateRefreshUtc != DateTime.MinValue && now - _lastStateRefreshUtc < GameTiming.Room.StateRefreshThrottle)
        {
            return;
        }
        _lastStateRefreshUtc = now;

        if (Interlocked.Exchange(ref _stateRefreshInFlight, 1) == 1)
        {
            return;
        }

        try
        {
            var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
            var join = JsonSerializer.Serialize(new
            {
                type = "room.join",
                payload = new
                {
                    roomId = RoomId,
                    spectator = _spectator,
                    hidden = _silent,
                    _trace = trace
                }
            }, _json);
            await _socket.SendAsync(join, _lifetimeCts.Token).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "RoomSession refresh failed (roomId={RoomId})", RoomId);
        }
        finally
        {
            Interlocked.Exchange(ref _stateRefreshInFlight, 0);
        }
    }

    private void HandleRoomState(JsonElement root)
    {
        try
        {
            if (root.TryGetProperty("roomId", out var roomIdProp))
            {
                var envelopeRoomId =
                    roomIdProp.ValueKind == JsonValueKind.Number && roomIdProp.TryGetInt32(out var roomIdNumber)
                        ? roomIdNumber
                        : roomIdProp.ValueKind == JsonValueKind.String && int.TryParse(roomIdProp.GetString(), out var roomIdText)
                            ? roomIdText
                            : 0;
                if (envelopeRoomId > 0 && envelopeRoomId != RoomId)
                {
                    // Ignore room state from another table.
                    return;
                }
            }

            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind == JsonValueKind.Undefined ||
                payloadProp.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = payloadProp.Deserialize<RoomPayloadDto>(_json);
            if (payload == null) return;

            LastRoomState = payload;
            RoomUpdated?.Invoke(payload);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "RoomSession: ignore message parse error");
        }
    }

    private void RequestReconnect(bool force) => _reconnectController.RequestReconnect(force);

    private static bool IsFatalReconnectError(string message)
    {
        if (IsFatalRoomError(message))
        {
            return true;
        }

        var normalized = (message ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return false;
        }

        return normalized.Contains("room not found", StringComparison.Ordinal) ||
               normalized.Contains("table not found", StringComparison.Ordinal);
    }

    private async Task EnsureJoinedAsync(CancellationToken cancellationToken)
    {
        // Best-effort: send join then wait for a room state update.
        try
        {
            var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
            var join = JsonSerializer.Serialize(new
            {
                type = "room.join",
                payload = new
                {
                    roomId = RoomId,
                    spectator = _spectator,
                    hidden = _silent,
                    _trace = trace
                }
            }, _json);
            await _socket.SendAsync(join, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            return;
        }

        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        void OnUpdate(RoomPayloadDto _) => tcs.TrySetResult(true);
        RoomUpdated += OnUpdate;
        try
        {
            using var timeout = new CancellationTokenSource(GameTiming.Room.EnsureJoinedTimeout);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
        finally
        {
            RoomUpdated -= OnUpdate;
        }
    }

    private async Task KeepAliveLoopAsync(CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(GameTiming.Room.KeepAliveTick);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var ok = await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false);
                if (!ok) return;
            }
            catch
            {
                return;
            }

            if (_reconnectAsync != null && _state == WebSocketState.Connected)
            {
                var age = DateTime.UtcNow - _lastPongUtc;
                if (_lastPongUtc != DateTime.MinValue && age > GameTiming.Room.GhostConnectionThreshold)
                {
                    // Socket "fantôme" probable: forcer une reconnexion.
                    RequestReconnect(force: true);
                    continue;
                }
            }

            if (_state != WebSocketState.Connected)
            {
                continue;
            }

            try
            {
                var ping = JsonSerializer.Serialize(
                    new { type = "room.ping", payload = new { clientSentAtMs = ServerClock.UtcNowMs() } },
                    _json);
                await _socket.SendAsync(ping, cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                // Best-effort: la reconnexion sera déclenchée par StateChanged ou par le watchdog.
            }
        }
    }

    private static TimeSpan ComputeBackoff(int attempt)
    {
        var seconds = attempt switch
        {
            1 => 1,
            2 => 2,
            3 => 5,
            4 => 10,
            5 => 20,
            6 => 30,
            _ => 30,
        };

        // Jitter +/-20% pour éviter que tout le monde reconnecte en même temps.
        return GameTiming.ComputeJitterBackoff(seconds);
    }

    private static Dictionary<string, object?> ToDictionary(object? payload)
    {
        if (payload is Dictionary<string, object?> dict)
        {
            return new Dictionary<string, object?>(dict, StringComparer.OrdinalIgnoreCase);
        }

        if (payload is IDictionary<string, object?> idict)
        {
            return new Dictionary<string, object?>(idict, StringComparer.OrdinalIgnoreCase);
        }

        try
        {
            var element = JsonSerializer.SerializeToElement(payload ?? new { }, _json);
            if (element.ValueKind != JsonValueKind.Object)
            {
                return new Dictionary<string, object?>();
            }

            var output = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in element.EnumerateObject())
            {
                output[prop.Name] = prop.Value.Clone();
            }
            return output;
        }
        catch
        {
            return new Dictionary<string, object?>();
        }
    }
    private sealed class RoomConnectionSupervisor : IAsyncDisposable
    {
        private readonly RoomSession _session;
        private readonly RoomAckTracker _ackTracker = new();
        private readonly Dictionary<string, TaskCompletionSource<RoomCommandAck?>> _pending = new(StringComparer.Ordinal);
        private bool _disposed;

        public RoomConnectionSupervisor(RoomSession session)
        {
            _session = session ?? throw new ArgumentNullException(nameof(session));
        }

        public Task RequestStateRefreshAsync(bool force) => _session.RequestStateRefreshCoreAsync(force);

        public async Task<bool> SendCommandAwaitAckAsync(string type, object? payload, TimeSpan? ackTimeout, CancellationToken cancellationToken)
        {
            if (_disposed)
            {
                return false;
            }

            var traceId = await _session.SendCommandWithTraceAsync(type, payload, cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(traceId))
            {
                return false;
            }

            TaskCompletionSource<RoomCommandAck?> tcs;
            lock (_pending)
            {
                tcs = new TaskCompletionSource<RoomCommandAck?>(TaskCreationOptions.RunContinuationsAsynchronously);
                _pending[traceId] = tcs;
            }

            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            linked.CancelAfter(ackTimeout ?? _ackTracker.ComputeAdaptiveTimeout());

            try
            {
                var ack = await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
                if (ack != null)
                {
                    _ackTracker.RecordLatency(ack.ClientToServerMs);
                    return true;
                }
            }
            catch (OperationCanceledException)
            {
            }
            finally
            {
                lock (_pending)
                {
                    _pending.Remove(traceId);
                }
            }

            return false;
        }

        public void HandleStateChanged(WebSocketState state)
        {
            if (state == WebSocketState.Error || state == WebSocketState.Disconnected)
            {
                _session.RequestReconnect(force: state == WebSocketState.Error);
            }
        }

        public void HandlePong(JsonElement root)
        {
            if (root.TryGetProperty("payload", out var payload) &&
                payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty("clientSentAtMs", out var _))
            {
                _session._lastPongUtc = DateTime.UtcNow;
            }
        }

        public void HandleCommandAck(JsonElement root)
        {
            if (_disposed)
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("traceId", out var traceIdProp) ||
                traceIdProp.ValueKind != JsonValueKind.String)
            {
                return;
            }

            var traceId = (traceIdProp.GetString() ?? string.Empty).Trim();
            if (traceId.Length == 0)
            {
                return;
            }

            var ack = new RoomCommandAck(
                payload.TryGetProperty("action", out var actionProp) && actionProp.ValueKind == JsonValueKind.String
                    ? actionProp.GetString() ?? string.Empty
                    : string.Empty,
                traceId,
                payload.TryGetProperty("receivedAtMs", out var receivedProp) && receivedProp.TryGetInt64(out var received)
                    ? received
                    : 0,
                payload.TryGetProperty("clientToServerMs", out var latencyProp) && latencyProp.TryGetInt64(out var latency)
                    ? latency
                    : 0);

            TaskCompletionSource<RoomCommandAck?>? tcs = null;
            lock (_pending)
            {
                if (_pending.TryGetValue(traceId, out var waiting))
                {
                    tcs = waiting;
                    _pending.Remove(traceId);
                }
            }

            if (tcs != null)
            {
                tcs.TrySetResult(ack);
            }
        }

        public async ValueTask DisposeAsync()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;

            List<TaskCompletionSource<RoomCommandAck?>> pending;
            lock (_pending)
            {
                pending = new List<TaskCompletionSource<RoomCommandAck?>>(_pending.Values);
                _pending.Clear();
            }

            foreach (var tcs in pending)
            {
                tcs.TrySetCanceled();
            }

            await Task.CompletedTask;
        }
    }
}



