using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Game.Common;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.User.Services;
using Serilog;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomGatewayClient : IRoomGatewayClient
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly Func<IWebSocketConnection> _socketFactory;
    private readonly IWsTicketProvider _tickets;
    private readonly SemaphoreSlim _warmGate = new(1, 1);
    private IWebSocketConnection? _warmSocket;
    private DateTime _warmConnectedAtUtc = DateTime.MinValue;

    public RoomGatewayClient(
        ClientConfiguration config,
        ISessionService session,
        Func<IWebSocketConnection> socketFactory,
        IWsTicketProvider tickets)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _socketFactory = socketFactory ?? throw new ArgumentNullException(nameof(socketFactory));
        _tickets = tickets ?? throw new ArgumentNullException(nameof(tickets));
    }

    public async Task WarmUpAsync(CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        var token = user?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        // Evite de multiplier les connexions : un seul warmup en vol.
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
            var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);

            var socket = _socketFactory();
            var startedAt = DateTime.UtcNow;
            try
            {
                Log.Information("WS room.warmup: connexion Ã  {Endpoint}", uri);
                await socket.ConnectAsync(uri, token: token, headers: headers, cancellationToken: cancellationToken)
                    .ConfigureAwait(false);
                _warmSocket = socket;
                _warmConnectedAtUtc = DateTime.UtcNow;
                Log.Information(
                    "WS room.warmup: connectÃ© en {ElapsedMs}ms",
                    (DateTime.UtcNow - startedAt).TotalMilliseconds);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "WS room.warmup: Ã©chec connexion.");
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

    public async Task<RoomSession> CreateAndConnectAsync(string gameType, CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        var token = user?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Utilisateur non authentifié.");
        }
        if (string.IsNullOrWhiteSpace(gameType))
        {
            throw new ArgumentException("gameType requis", nameof(gameType));
        }

        var startedAt = DateTime.UtcNow;
        using var timeout = new CancellationTokenSource(GameTiming.Room.GatewayConnectTimeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

        const int maxAttempts = 2;
        Exception? lastError = null;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            var (socket, reusedWarm) = await TakeOrCreateSocketAsync(token, linked.Token).ConfigureAwait(false);
            try
            {
                if (!reusedWarm)
                {
                    Log.Information("WS room.create: socket cold (handshake requis)");
                }
                else
                {
                    Log.Information("WS room.create: socket warm réutilisé");
                }

                var created = await WaitRoomCreatedAsync(socket, gameType, linked.Token).ConfigureAwait(false);
                var roomId = created.RoomId;
                if (roomId <= 0)
                {
                    await socket.CloseAsync().ConfigureAwait(false);
                    await socket.DisposeAsync().ConfigureAwait(false);
                    throw new InvalidOperationException("Création de table échouée (roomId invalide).");
                }

                Log.Information("Connexion à la room WS (réutilisation socket) roomId={RoomId}", roomId);
                var session = new RoomSession(
                    roomId,
                    gameType,
                    socket,
                    returnSocketAsync: ReturnWarmSocketAsync,
                    reconnectAsync: ReconnectBaseAsync,
                    spectator: false,
                    silent: false);
                session.LastRoomState = created.Payload;
                Log.Information(
                    "WS room.create: create+connect total {ElapsedMs}ms (roomId={RoomId})",
                    (DateTime.UtcNow - startedAt).TotalMilliseconds,
                    roomId);
                return session;
            }
            catch (Exception ex)
            {
                lastError = ex;
                await ReturnWarmSocketAsync(socket).ConfigureAwait(false);

                var shouldRetry =
                    attempt < maxAttempts &&
                    !linked.IsCancellationRequested &&
                    IsTransientCreateFailure(ex);
                if (!shouldRetry)
                {
                    throw;
                }

                Log.Warning(ex, "WS room.create: échec transitoire (tentative {Attempt}/{MaxAttempts}), retry", attempt, maxAttempts);
                await Task.Delay(GameTiming.Room.GatewayRetryDelay, linked.Token).ConfigureAwait(false);
            }
        }

        throw lastError ?? new InvalidOperationException("Création de table échouée.");
    }
public async Task<RoomSession> ConnectAsync(int roomId, CancellationToken cancellationToken = default)
    {
        return await ConnectAsync(roomId, spectator: false, cancellationToken).ConfigureAwait(false);
    }

    public async Task<RoomSession> ConnectAsync(int roomId, bool spectator, CancellationToken cancellationToken = default)
    {
        return await ConnectAsync(roomId, spectator, silent: false, cancellationToken).ConfigureAwait(false);
    }

    public async Task<RoomSession> ConnectAsync(int roomId, bool spectator, bool silent, CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        var token = user?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Utilisateur non authentifiÃ©.");
        }
        if (roomId <= 0)
        {
            throw new ArgumentException("roomId invalide", nameof(roomId));
        }

        using var timeout = new CancellationTokenSource(GameTiming.Room.GatewayConnectTimeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

        var (socket, reusedWarm) = await TakeOrCreateSocketAsync(token, linked.Token).ConfigureAwait(false);

        // IMPORTANT: attach an early listener BEFORE any join/connect to avoid missing the first `room.updated`.
        RoomEnvelope<RoomPayloadDto>? earlyRoomUpdated = null;
        Exception? earlyError = null;

        void EarlyOnMessage(string raw)
        {
            if (earlyRoomUpdated != null || earlyError != null) return;
            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (!doc.RootElement.TryGetProperty("type", out var typeProp) ||
                    typeProp.ValueKind != JsonValueKind.String)
                {
                    return;
                }

                var type = typeProp.GetString() ?? string.Empty;
                if (string.Equals(type, "room.pong", StringComparison.OrdinalIgnoreCase))
                {
                    TryUpdateClockFromPong(doc.RootElement);
                    return;
                }

                if (string.Equals(type, "room.updated", StringComparison.OrdinalIgnoreCase))
                {
                    earlyRoomUpdated = JsonSerializer.Deserialize<RoomEnvelope<RoomPayloadDto>>(raw, _json);
                    return;
                }

                if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
                {
                    string? message = null;
                    if (doc.RootElement.TryGetProperty("payload", out var payload) &&
                        payload.ValueKind == JsonValueKind.Object &&
                        payload.TryGetProperty("message", out var messageProp) &&
                        messageProp.ValueKind == JsonValueKind.String)
                    {
                        message = messageProp.GetString();
                    }

                    earlyError = new InvalidOperationException(
                        string.IsNullOrWhiteSpace(message) ? "Erreur connexion table." : message);
                }
            }
            catch
            {
                // ignore
            }
        }

        void EarlyOnError(string message)
        {
            if (earlyError != null) return;
            if (string.IsNullOrWhiteSpace(message)) return;
            earlyError = new InvalidOperationException(message.Trim());
        }

        socket.MessageReceived += EarlyOnMessage;
        socket.Error += EarlyOnError;

        try
        {
            try
            {
                if (reusedWarm)
                {
                    // Switch room via command to avoid an extra handshake.
                    await TrySyncClockAsync(socket, linked.Token).ConfigureAwait(false);

                    var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
                    var join = JsonSerializer.Serialize(new
                    {
                        type = "room.join",
                        payload = new
                        {
                            roomId,
                            spectator,
                            hidden = silent,
                            _trace = trace
                        }
                    }, _json);
                    await socket.SendAsync(join, linked.Token).ConfigureAwait(false);
                }
                else
                {
                    // Fallback: connect directly with query params.
                    var uri = BuildRoomUri(_config.RealtimeGatewayWs, roomId, spectator, silent);
                    var headers = await BuildHeadersAsync(linked.Token).ConfigureAwait(false);
                    Log.Information("WS room.connect: connexion Ã  {Endpoint}", uri);
                    await socket.ConnectAsync(uri, token: token, headers: headers, cancellationToken: linked.Token).ConfigureAwait(false);
                }

                await TrySyncClockAsync(socket, linked.Token).ConfigureAwait(false);

                if (earlyError != null)
                {
                    throw earlyError;
                }

                var initial = earlyRoomUpdated ?? await WaitRoomStateAsync(socket, linked.Token).ConfigureAwait(false);
                var payload = initial.Payload;
                if (payload?.Room == null)
                {
                    await socket.CloseAsync().ConfigureAwait(false);
                    await socket.DisposeAsync().ConfigureAwait(false);
                    throw new InvalidOperationException("Connexion table Ã©chouÃ©e (Ã©tat manquant).");
                }

                var gameType = payload.Room.GameType;
                var session = new RoomSession(
                    roomId,
                    gameType,
                    socket,
                    returnSocketAsync: ReturnWarmSocketAsync,
                    reconnectAsync: ReconnectBaseAsync,
                    spectator: spectator,
                    silent: silent);
                session.LastRoomState = payload;
                return session;
            }
            catch
            {
                await ReturnWarmSocketAsync(socket).ConfigureAwait(false);
                throw;
            }
        }
        finally
        {
            socket.MessageReceived -= EarlyOnMessage;
            socket.Error -= EarlyOnError;
        }
    }

    private async Task ReturnWarmSocketAsync(IWebSocketConnection socket)
    {
        if (socket == null) return;

        // Never keep a disconnected/error socket in the warm pool.
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

        Log.Warning("WS room: socket supplÃ©mentaire retournÃ©; fermeture pour Ã©viter une fuite.");
        try { await socket.CloseAsync().ConfigureAwait(false); } catch { }
        try { await socket.DisposeAsync().ConfigureAwait(false); } catch { }
    }

    private async Task ReconnectBaseAsync(IWebSocketConnection socket, CancellationToken cancellationToken)
    {
        var user = _session.CurrentUser;
        var token = user?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Utilisateur non authentifiÃ©.");
        }

        var uri = BuildRoomUri(_config.RealtimeGatewayWs, roomId: 0);
        var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
        await socket.ConnectAsync(uri, token: token, headers: headers, cancellationToken: cancellationToken).ConfigureAwait(false);

        await TrySyncClockAsync(socket, cancellationToken).ConfigureAwait(false);
    }

    private async Task<(IWebSocketConnection socket, bool reusedWarm)> TakeOrCreateSocketAsync(
        string token,
        CancellationToken cancellationToken)
    {
        // Try to reuse a warm socket (created by WarmUpAsync).
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
                return (warm, true);
            }
        }

        var socket = _socketFactory();
        var uri = BuildRoomUri(_config.RealtimeGatewayWs, roomId: 0);

        var headersStartedAt = DateTime.UtcNow;
        var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
        Log.Information(
            "WS room.connect: ticket+headers en {ElapsedMs}ms",
            (DateTime.UtcNow - headersStartedAt).TotalMilliseconds);

        var connectStartedAt = DateTime.UtcNow;
        Log.Information("WS room.connect: connexion Ã  {Endpoint}", uri);
        await socket.ConnectAsync(uri, token: token, headers: headers, cancellationToken: cancellationToken)
            .ConfigureAwait(false);
        Log.Information(
            "WS room.connect: handshake WS en {ElapsedMs}ms",
            (DateTime.UtcNow - connectStartedAt).TotalMilliseconds);

        return (socket, false);
    }

    private static async Task<RoomEnvelope<RoomPayloadDto>> WaitRoomCreatedAsync(
        IWebSocketConnection socket,
        string gameType,
        CancellationToken cancellationToken)
    {
        var tcs = new TaskCompletionSource<RoomEnvelope<RoomPayloadDto>>(TaskCreationOptions.RunContinuationsAsynchronously);
        var connected = false;
        var startedAt = DateTime.UtcNow;
        void OnMessage(string raw)
        {
            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (!doc.RootElement.TryGetProperty("type", out var typeProp) ||
                    typeProp.ValueKind != JsonValueKind.String)
                {
                    return;
                }

                var type = typeProp.GetString() ?? string.Empty;
                if (string.Equals(type, "room.pong", StringComparison.OrdinalIgnoreCase))
                {
                    TryUpdateClockFromPong(doc.RootElement);
                    return;
                }
                if (string.Equals(type, "room.created", StringComparison.OrdinalIgnoreCase))
                {
                    var msg = JsonSerializer.Deserialize<RoomEnvelope<RoomPayloadDto>>(raw, _json);
                    if (msg != null)
                    {
                        tcs.TrySetResult(msg);
                    }
                    return;
                }

                if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
                {
                    string? message = null;
                    if (doc.RootElement.TryGetProperty("payload", out var payload) &&
                        payload.ValueKind == JsonValueKind.Object &&
                        payload.TryGetProperty("message", out var messageProp) &&
                        messageProp.ValueKind == JsonValueKind.String)
                    {
                        message = messageProp.GetString();
                    }

                    tcs.TrySetException(new InvalidOperationException(
                        string.IsNullOrWhiteSpace(message) ? "Erreur crÃ©ation de table." : message));
                }
            }
            catch
            {
                // ignore
            }
        }

        void OnError(string message)
        {
            if (tcs.Task.IsCompleted) return;
            tcs.TrySetException(new InvalidOperationException(message));
        }

        void OnStateChanged(WebSocketState state)
        {
            if (tcs.Task.IsCompleted) return;
            if (!connected) return;
            if (state is WebSocketState.Error or WebSocketState.Disconnected)
            {
                tcs.TrySetException(new InvalidOperationException(
                    "Connexion WebSocket fermÃ©e pendant la crÃ©ation de table. VÃ©rifiez la connectivitÃ© WS."));
            }
        }

        socket.MessageReceived += OnMessage;
        socket.Error += OnError;
        socket.StateChanged += OnStateChanged;

        try
        {
            await TrySyncClockAsync(socket, cancellationToken).ConfigureAwait(false);

            var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
            var create = JsonSerializer.Serialize(
                new { type = "room.create", payload = new { gameType, _trace = trace } },
                _json);
            await socket.SendAsync(create, cancellationToken).ConfigureAwait(false);
            connected = true;

            using var timeout = new CancellationTokenSource(GameTiming.Room.GatewayConnectTimeout);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            var res = await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
            Log.Information("WS room.create: rÃ©ponse reÃ§ue en {ElapsedMs}ms (roomId={RoomId})", (DateTime.UtcNow - startedAt).TotalMilliseconds, res.RoomId);
            return res;
        }
        catch (OperationCanceledException)
        {
            throw new InvalidOperationException("Timeout crÃ©ation de table.");
        }
        finally
        {
            socket.MessageReceived -= OnMessage;
            socket.Error -= OnError;
            socket.StateChanged -= OnStateChanged;
        }
    }

    private static async Task<RoomEnvelope<RoomPayloadDto>> WaitRoomStateAsync(
        IWebSocketConnection socket,
        CancellationToken cancellationToken)
    {
        var tcs = new TaskCompletionSource<RoomEnvelope<RoomPayloadDto>>(TaskCreationOptions.RunContinuationsAsynchronously);
        var connected = false;
        var startedAt = DateTime.UtcNow;

        void OnMessage(string raw)
        {
            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (!doc.RootElement.TryGetProperty("type", out var typeProp) ||
                    typeProp.ValueKind != JsonValueKind.String)
                {
                    return;
                }

                var type = typeProp.GetString() ?? string.Empty;
                if (string.Equals(type, "room.pong", StringComparison.OrdinalIgnoreCase))
                {
                    TryUpdateClockFromPong(doc.RootElement);
                    return;
                }
                if (string.Equals(type, "room.updated", StringComparison.OrdinalIgnoreCase))
                {
                    var msg = JsonSerializer.Deserialize<RoomEnvelope<RoomPayloadDto>>(raw, _json);
                    if (msg != null)
                    {
                        tcs.TrySetResult(msg);
                    }
                    return;
                }

                if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
                {
                    string? message = null;
                    if (doc.RootElement.TryGetProperty("payload", out var payload) &&
                        payload.ValueKind == JsonValueKind.Object &&
                        payload.TryGetProperty("message", out var messageProp) &&
                        messageProp.ValueKind == JsonValueKind.String)
                    {
                        message = messageProp.GetString();
                    }

                    tcs.TrySetException(new InvalidOperationException(
                        string.IsNullOrWhiteSpace(message) ? "Erreur connexion table." : message));
                }
            }
            catch
            {
                // ignore
            }
        }

        void OnError(string message)
        {
            if (tcs.Task.IsCompleted) return;
            tcs.TrySetException(new InvalidOperationException(message));
        }

        void OnStateChanged(WebSocketState state)
        {
            if (tcs.Task.IsCompleted) return;
            if (!connected) return;
            if (state is WebSocketState.Error or WebSocketState.Disconnected)
            {
                tcs.TrySetException(new InvalidOperationException(
                    "Connexion WebSocket fermÃ©e pendant la connexion Ã  la table. VÃ©rifiez la connectivitÃ© WS."));
            }
        }

        socket.MessageReceived += OnMessage;
        socket.Error += OnError;
        socket.StateChanged += OnStateChanged;

        try
        {
            connected = true;

            using var timeout = new CancellationTokenSource(GameTiming.Room.GatewayConnectTimeout);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            var res = await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
            Log.Information("WS room.connect: Ã©tat reÃ§u en {ElapsedMs}ms (roomId={RoomId})", (DateTime.UtcNow - startedAt).TotalMilliseconds, res.RoomId);
            return res;
        }
        catch (OperationCanceledException)
        {
            throw new InvalidOperationException("Timeout connexion table.");
        }
        finally
        {
            socket.MessageReceived -= OnMessage;
            socket.Error -= OnError;
            socket.StateChanged -= OnStateChanged;
        }
    }

    private static bool IsTransientCreateFailure(Exception ex)
    {
        if (ex is OperationCanceledException)
        {
            return false;
        }

        var message = (ex.Message ?? string.Empty).Trim();
        if (message.Length == 0)
        {
            return false;
        }

        return message.Contains("WebSocket ferm", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("Timeout cr", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("Connexion table", StringComparison.OrdinalIgnoreCase);
    }

    private static Uri BuildRoomUri(Uri baseWs, int roomId, bool spectator = false, bool silent = false)
    {
        var builder = new UriBuilder(baseWs);
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(builder.Query))
        {
            query.Add(builder.Query.TrimStart('?'));
        }
        if (roomId > 0)
        {
            query.Add($"room={roomId}");
            if (spectator)
            {
                query.Add("spectator=1");
            }
            if (silent)
            {
                // Admin hidden join (backward compat: server still accepts `silent=1` too).
                query.Add("hidden=1");
            }
        }
        builder.Query = string.Join("&", query);
        return builder.Uri;
    }

    private static async Task TrySyncClockAsync(IWebSocketConnection socket, CancellationToken cancellationToken)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        void OnMessage(string raw)
        {
            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (!doc.RootElement.TryGetProperty("type", out var typeProp) ||
                    typeProp.ValueKind != JsonValueKind.String)
                {
                    return;
                }

                var type = typeProp.GetString() ?? string.Empty;
                if (!string.Equals(type, "room.pong", StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                if (TryUpdateClockFromPong(doc.RootElement))
                {
                    tcs.TrySetResult(true);
                }
            }
            catch
            {
                // ignore
            }
        }

        socket.MessageReceived += OnMessage;

        try
        {
            var ping = JsonSerializer.Serialize(
                new { type = "room.ping", payload = new { clientSentAtMs = ServerClock.UtcNowMs() } },
                _json);
            await socket.SendAsync(ping, cancellationToken).ConfigureAwait(false);

            using var timeout = new CancellationTokenSource(GameTiming.Room.ClockSyncTimeout);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
        }
        catch
        {
            // Best-effort: si le ping Ã©choue ou timeout, on continue quand mÃªme.
        }
        finally
        {
            socket.MessageReceived -= OnMessage;
        }
    }

    private static bool TryUpdateClockFromPong(JsonElement root)
    {
        var receivedAtMs = ServerClock.UtcNowMs();

        try
        {
            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (!payload.TryGetProperty("serverTimeMs", out var serverTimeProp) ||
                serverTimeProp.ValueKind != JsonValueKind.Number)
            {
                return false;
            }

            if (!payload.TryGetProperty("clientSentAtMs", out var clientSentProp) ||
                clientSentProp.ValueKind != JsonValueKind.Number)
            {
                return false;
            }

            var serverTimeMs = serverTimeProp.GetInt64();
            var clientSentAtMs = clientSentProp.GetInt64();
            ServerClock.UpdateFromPong(serverTimeMs, clientSentAtMs, receivedAtMs);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<IDictionary<string, string>?> BuildHeadersAsync(CancellationToken cancellationToken)
    {
        var ticket = await _tickets.GetTicketAsync("room", cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(ticket))
        {
            return null;
        }
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["x-lila-ws-ticket"] = ticket
        };
    }
}

