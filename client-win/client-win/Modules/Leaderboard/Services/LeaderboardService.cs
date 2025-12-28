using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Core.Network;
using client_win.Modules.Leaderboard.Dtos;
using client_win.Modules.Network;
using client_win.Modules.User.Services;

namespace client_win.Modules.Leaderboard.Services;

public sealed class LeaderboardService : ILeaderboardService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;

    public LeaderboardService(WsRequestClient ws, ISessionService session)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
    }

    public async Task<IReadOnlyList<LeaderboardGameDto>> GetGamesAsync(CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var network = NetworkConfiguration.Load();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(30, network.ReceiveTimeoutSeconds + 5)));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, cts.Token);

        var response = await _ws.RequestAsync<LeaderboardGamesPayload>(
            WsMessageTypes.Leaderboard.Games,
            new { },
            token,
            linked.Token).ConfigureAwait(false);

        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Classement indisponible.");
        }

        return response.Payload?.Games ?? new List<LeaderboardGameDto>();
    }

    public async Task<LeaderboardTopPayload> GetTop10Async(string gameType, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var network = NetworkConfiguration.Load();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(30, network.ReceiveTimeoutSeconds + 5)));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, cts.Token);

        var response = await _ws.RequestAsync<LeaderboardTopPayload>(
            WsMessageTypes.Leaderboard.Top,
            new { gameType },
            token,
            linked.Token).ConfigureAwait(false);

        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Classement indisponible.");
        }

        return response.Payload ?? new LeaderboardTopPayload { GameType = gameType };
    }
}
