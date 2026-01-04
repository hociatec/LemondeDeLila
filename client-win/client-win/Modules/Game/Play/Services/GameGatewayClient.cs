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
    private readonly SemaphoreSlim _warmGate = new(1, 1);
    private IWebSocketConnection? _warmSocket;
    private DateTime _warmConnectedAtUtc = DateTime.MinValue;

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

    public async Task WarmUpAsync(CancellationToken cancellationToken = default)
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

            var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
            var socket = _socketFactory();
            var startedAt = DateTime.UtcNow;
            try
            {
                Log.Information("WS game.warmup: connexion à {Endpoint}", _config.GameGatewayWs);
                await socket.ConnectAsync(_config.GameGatewayWs, token: token, headers: headers, cancellationToken: cancellationToken)
                    .ConfigureAwait(false);
                _warmSocket = socket;
                _warmConnectedAtUtc = DateTime.UtcNow;
                Log.Information(
                    "WS game.warmup: connecté en {ElapsedMs}ms",
                    (DateTime.UtcNow - startedAt).TotalMilliseconds);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "WS game.warmup: échec connexion.");
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

        var (socket, reusedWarm) = await TakeOrCreateSocketAsync(token, cancellationToken).ConfigureAwait(false);
        if (reusedWarm)
        {
            Log.Information("WS game.connect: socket warm réutilisé");
        }

        Log.Debug("Connexion au game WS roomId={RoomId} gameType={GameType}", roomId, gameType);

        var session = new GameSession(roomId, gameType, socket);
        try
        {
            await session.JoinAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (reusedWarm)
        {
            // Le warm socket peut avoir été fermé par le serveur. Fallback: reconnect cold.
            Log.Warning(ex, "WS game.connect: warm socket invalide, fallback cold.");
            await session.DisposeAsync().ConfigureAwait(false);

            var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
            var cold = _socketFactory();
            await cold.ConnectAsync(_config.GameGatewayWs, token: token, headers: headers, cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            session = new GameSession(roomId, gameType, cold);
            await session.JoinAsync(cancellationToken).ConfigureAwait(false);
        }

        Log.Information("Connecté au game WS roomId={RoomId} gameType={GameType}", roomId, gameType);
        return session;
    }

    private async Task<(IWebSocketConnection socket, bool reusedWarm)> TakeOrCreateSocketAsync(
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
            return (warm, true);
        }

        var socket = _socketFactory();
        var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
        await socket.ConnectAsync(_config.GameGatewayWs, token: token, headers: headers, cancellationToken: cancellationToken)
            .ConfigureAwait(false);
        return (socket, false);
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
