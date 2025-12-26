using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Play.Services;

public interface IGameGatewayClient
{
    Task<GameSession> ConnectAsync(int roomId, string gameType, CancellationToken cancellationToken = default);
}
