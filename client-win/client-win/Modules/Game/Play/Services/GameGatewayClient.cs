using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.User.Services;
using Serilog;

namespace client_win.Modules.Game.Play.Services;

public sealed class GameGatewayClient : IGameGatewayClient
{
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly Func<IWebSocketConnection> _socketFactory;
    private readonly IWsTicketProvider _tickets;

    public GameGatewayClient(
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

    public async Task<GameSession> ConnectAsync(
        int roomId,
        string gameType,
        CancellationToken cancellationToken = default)
    {
        if (roomId <= 0) throw new ArgumentOutOfRangeException(nameof(roomId));
        if (string.IsNullOrWhiteSpace(gameType)) throw new ArgumentException("gameType requis", nameof(gameType));

        var user = _session.CurrentUser;
        var token = user?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Utilisateur non authentifie.");
        }

        var socket = _socketFactory();
        var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);

        Log.Debug("Connexion au game WS roomId={RoomId} gameType={GameType}", roomId, gameType);

        await socket.ConnectAsync(_config.GameGatewayWs, token: token, headers: headers, cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        var session = new GameSession(roomId, gameType, socket);
        await session.JoinAsync(cancellationToken).ConfigureAwait(false);

        Log.Information("Connecté au game WS roomId={RoomId} gameType={GameType}", roomId, gameType);
        return session;
    }

    private async Task<IDictionary<string, string>?> BuildHeadersAsync(CancellationToken cancellationToken)
    {
        var ticket = await _tickets.GetTicketAsync("game", cancellationToken).ConfigureAwait(false);
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
