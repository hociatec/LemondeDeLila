using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using Serilog;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomSession : IAsyncDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly IWebSocketConnection _socket;
    private readonly Func<IWebSocketConnection, Task>? _returnSocketAsync;
    private readonly Func<IWebSocketConnection, CancellationToken, Task>? _reconnectAsync;
    private readonly bool _spectator;
    private readonly bool _silent;

    private readonly CancellationTokenSource _lifetimeCts = new();
    private Task? _keepAliveLoop;
    private Task? _reconnectLoop;
    private int _reconnectRequested;
    private int _forceReconnectRequested;
    private int _reconnectAttempt;
    private DateTime _lastPongUtc = DateTime.MinValue;
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

        _lastPongUtc = DateTime.UtcNow;
        _keepAliveLoop = Task.Run(() => KeepAliveLoopAsync(_lifetimeCts.Token));
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

    public async Task SendCommandAsync(string type, object? payload = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(type)) throw new ArgumentException("type requis", nameof(type));
        var merged = ToDictionary(payload);
        merged["_trace"] = new
        {
            id = Guid.NewGuid().ToString("N"),
            sentAtMs = ServerClock.NowServerMs()
        };
        var msg = JsonSerializer.Serialize(new { type, payload = merged }, _json);
        await _socket.SendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

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
        try { _lifetimeCts.Cancel(); } catch { }

        if (_keepAliveLoop != null)
        {
            try { await _keepAliveLoop.ConfigureAwait(false); } catch { }
            _keepAliveLoop = null;
        }
        if (_reconnectLoop != null)
        {
            try { await _reconnectLoop.ConfigureAwait(false); } catch { }
            _reconnectLoop = null;
        }

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

        if (_reconnectAsync == null)
        {
            return;
        }

        if (state is WebSocketState.Disconnected or WebSocketState.Error)
        {
            RequestReconnect(force: false);
        }
        else if (state == WebSocketState.Connected)
        {
            _reconnectAttempt = 0;
            _lastPongUtc = DateTime.UtcNow;

            // Après reconnexion, il faut se rattacher à la table.
            _ = Task.Run(() => EnsureJoinedAsync(CancellationToken.None));
        }
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
                HandlePong(root);
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

    private void HandlePong(JsonElement root)
    {
        var receivedAtMs = ServerClock.UtcNowMs();
        _lastPongUtc = DateTime.UtcNow;

        try
        {
            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("serverTimeMs", out var serverTimeProp) ||
                serverTimeProp.ValueKind != JsonValueKind.Number)
            {
                return;
            }

            if (!payload.TryGetProperty("clientSentAtMs", out var clientSentProp) ||
                clientSentProp.ValueKind != JsonValueKind.Number)
            {
                return;
            }

            var serverTimeMs = serverTimeProp.GetInt64();
            var clientSentAtMs = clientSentProp.GetInt64();
            ServerClock.UpdateFromPong(serverTimeMs, clientSentAtMs, receivedAtMs);
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

            ErrorReceived?.Invoke(message.Trim());
        }
        catch
        {
            // ignore
        }
    }

    private void HandleRoomState(JsonElement root)
    {
        try
        {
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

    private void RequestReconnect(bool force)
    {
        if (_reconnectAsync == null) return;
        if (_lifetimeCts.IsCancellationRequested) return;

        Interlocked.Exchange(ref _reconnectRequested, 1);
        if (force)
        {
            Interlocked.Exchange(ref _forceReconnectRequested, 1);
        }

        if (_reconnectLoop != null && !_reconnectLoop.IsCompleted)
        {
            return;
        }

        _reconnectLoop = Task.Run(() => ReconnectLoopAsync(_lifetimeCts.Token));
    }

    private async Task ReconnectLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var want = Interlocked.CompareExchange(ref _reconnectRequested, 0, 1) == 1;
            var force = Interlocked.CompareExchange(ref _forceReconnectRequested, 0, 1) == 1;
            if (!want && !force)
            {
                return;
            }

            if (!force && _state == WebSocketState.Connected)
            {
                // Déjà connecté, rien à faire (sauf si force).
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
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(12));
                using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

                await _reconnectAsync!(_socket, linked.Token).ConfigureAwait(false);
                await EnsureJoinedAsync(linked.Token).ConfigureAwait(false);

                _reconnectAttempt = 0;
                return;
            }
            catch
            {
                // Continue loop: we'll retry.
                Interlocked.Exchange(ref _reconnectRequested, 1);
            }
        }
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
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
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
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(20));

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
                if (_lastPongUtc != DateTime.MinValue && age > TimeSpan.FromSeconds(60))
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
        var jitter = 0.8 + (Random.Shared.NextDouble() * 0.4);
        return TimeSpan.FromMilliseconds(Math.Max(250, seconds * 1000 * jitter));
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
}
