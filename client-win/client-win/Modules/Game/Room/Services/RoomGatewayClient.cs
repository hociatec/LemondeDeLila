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
        void OnMessage(string raw)
        {
            try
            {
                var msg = JsonSerializer.Deserialize<RoomEnvelope<RoomPayloadDto>>(raw, _json);
                if (msg == null) return;
                if (!string.Equals(msg.Type, "room.created", StringComparison.OrdinalIgnoreCase)) return;
                tcs.TrySetResult(msg);
            }
            catch
            {
                // ignore
            }
        }

        socket.MessageReceived += OnMessage;

        try
        {
            await socket.ConnectAsync(uri, token: null, headers: headers, cancellationToken: cancellationToken).ConfigureAwait(false);
            var create = JsonSerializer.Serialize(new { type = "room.create", payload = new { gameType } }, _json);
            await socket.SendAsync(create, cancellationToken).ConfigureAwait(false);

            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            var res = await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
            return res;
        }
        catch (OperationCanceledException)
        {
            throw new InvalidOperationException("Timeout création de table.");
        }
        finally
        {
            socket.MessageReceived -= OnMessage;
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
