using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Core.Network;
using client_win.Modules.Network;
using client_win.Modules.Stats.Dtos;
using client_win.Modules.User.Services;

namespace client_win.Modules.Stats.Services;

public sealed class StatsService : IStatsService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;

    public StatsService(WsRequestClient ws, ISessionService session)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
    }

    public async Task<IReadOnlyList<MyGameStatsDto>> GetMyStatsAsync(CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var network = NetworkConfiguration.Load();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(30, network.ReceiveTimeoutSeconds + 5)));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, cts.Token);

        var response = await _ws.RequestAsync<MyStatsPayload>(
            WsMessageTypes.Stats.My,
            new { },
            token,
            linked.Token).ConfigureAwait(false);

        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Statistiques indisponibles.");
        }

        return response.Payload?.Games ?? new List<MyGameStatsDto>();
    }
}
