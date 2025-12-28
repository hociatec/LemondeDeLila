using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Leaderboard.Dtos;

namespace client_win.Modules.Leaderboard.Services;

public interface ILeaderboardService
{
    Task<IReadOnlyList<LeaderboardGameDto>> GetGamesAsync(CancellationToken cancellationToken = default);
    Task<LeaderboardTopPayload> GetTop10Async(string gameType, CancellationToken cancellationToken = default);
}

