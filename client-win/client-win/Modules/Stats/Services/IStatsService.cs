using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Stats.Dtos;

namespace client_win.Modules.Stats.Services;

public interface IStatsService
{
    Task<IReadOnlyList<MyGameStatsDto>> GetMyStatsAsync(CancellationToken cancellationToken = default);
}

