using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
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

    public RoomGatewayClient(ClientConfiguration config, ISessionService session, Func<IWebSocketConnection> socketFactory)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _socketFactory = socketFactory ?? throw new ArgumentNullException(nameof(socketFactory));
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

        var created = await CreateRoomAsync(gameType, token, cancellationToken).ConfigureAwait(false);
        var roomId = created.RoomId;
        if (roomId <= 0)
        {
            throw new InvalidOperationException("Création de table échouée (roomId invalide).");
        }

        var socket = _socketFactory();
        var uri = BuildRoomUri(_config.RealtimeGatewayWs, token, roomId);
        var headers = BuildHeaders(_config.SharedSecret);

        Log.Information("Connexion à la room WS roomId={RoomId}", roomId);
        await socket.ConnectAsync(uri, token: null, headers: headers, cancellationToken: cancellationToken).ConfigureAwait(false);

        var session = new RoomSession(roomId, gameType, socket);
        // Le backend envoie un room.updated à la connexion ; sinon on garde au moins l'état "created".
        session.LastRoomState = created.Payload;
        return session;
    }

    private async Task<RoomEnvelope<RoomPayloadDto>> CreateRoomAsync(string gameType, string token, CancellationToken cancellationToken)
    {
        var socket = _socketFactory();
        var uri = BuildRoomUri(_config.RealtimeGatewayWs, token, roomId: 0);
        var headers = BuildHeaders(_config.SharedSecret);

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
                        string.IsNullOrWhiteSpace(message) ? "Erreur création de table." : message));
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
                    "Connexion WebSocket fermée pendant la création de table. Vérifiez network.ws.secret et la connectivité WS."));
            }
        }

        socket.MessageReceived += OnMessage;
        socket.Error += OnError;
        socket.StateChanged += OnStateChanged;

        try
        {
            Log.Information("WS room.create: connexion à {Endpoint}", uri);
            await socket.ConnectAsync(uri, token: null, headers: headers, cancellationToken: cancellationToken).ConfigureAwait(false);
            connected = true;
            Log.Information("WS room.create: connecté en {ElapsedMs}ms", (DateTime.UtcNow - startedAt).TotalMilliseconds);
            var create = JsonSerializer.Serialize(new { type = "room.create", payload = new { gameType } }, _json);
            await socket.SendAsync(create, cancellationToken).ConfigureAwait(false);

            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            var res = await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
            Log.Information("WS room.create: réponse reçue en {ElapsedMs}ms (roomId={RoomId})", (DateTime.UtcNow - startedAt).TotalMilliseconds, res.RoomId);
            return res;
        }
        catch (OperationCanceledException)
        {
            throw new InvalidOperationException("Timeout création de table.");
        }
        finally
        {
            socket.MessageReceived -= OnMessage;
            socket.Error -= OnError;
            socket.StateChanged -= OnStateChanged;
            await socket.CloseAsync().ConfigureAwait(false);
            await socket.DisposeAsync().ConfigureAwait(false);
        }
    }

    private static Uri BuildRoomUri(Uri baseWs, string token, int roomId)
    {
        var builder = new UriBuilder(baseWs);
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(builder.Query))
        {
            query.Add(builder.Query.TrimStart('?'));
        }
        query.Add($"token={Uri.EscapeDataString(token)}");
        if (roomId > 0)
        {
            query.Add($"room={roomId}");
        }
        builder.Query = string.Join("&", query);
        return builder.Uri;
    }

    private static IDictionary<string, string>? BuildHeaders(string? sharedSecret)
    {
        if (string.IsNullOrWhiteSpace(sharedSecret))
        {
            return null;
        }
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["x-lila-ws-signature"] = sharedSecret
        };
    }
}
