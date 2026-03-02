using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Game.Common;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.User.Services;
using Serilog;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed partial class RoomGatewayClient : IRoomGatewayClient
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly Func<IWebSocketConnection> _socketFactory;
    private readonly IWsTicketProvider _tickets;
    private readonly WarmSocketPool _socketPool;

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
        _socketPool = new WarmSocketPool(this, _config, _session, _socketFactory, _tickets);
    }

    public async Task WarmUpAsync(CancellationToken cancellationToken = default)
    {
        await _socketPool.WarmUpAsync(cancellationToken).ConfigureAwait(false);
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
            var (socket, reusedWarm) = await _socketPool.TakeOrCreateSocketAsync(token, linked.Token).ConfigureAwait(false);
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

        var (socket, reusedWarm) = await _socketPool.TakeOrCreateSocketAsync(token, linked.Token).ConfigureAwait(false);

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

    private Task ReturnWarmSocketAsync(IWebSocketConnection socket) =>
        _socketPool.ReturnWarmSocketAsync(socket);

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
