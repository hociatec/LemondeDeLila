using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Play.Session.Services;

public interface IGameGatewayClient
{
    Task WarmUpAsync(CancellationToken cancellationToken = default);
    Task<GameSession> ConnectAsync(int roomId, string gameType, CancellationToken cancellationToken = default);
}
