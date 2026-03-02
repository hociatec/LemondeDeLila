using System.Threading;
using System.Threading.Tasks;
namespace client_win.Modules.Game.Room.Services;

public interface IRoomGatewayClient
{
    Task WarmUpAsync(CancellationToken cancellationToken = default);
    Task<IRoomSession> CreateAndConnectAsync(string gameType, CancellationToken cancellationToken = default);
    Task<IRoomSession> ConnectAsync(int roomId, CancellationToken cancellationToken = default);
    Task<IRoomSession> ConnectAsync(int roomId, bool spectator, CancellationToken cancellationToken = default);
    Task<IRoomSession> ConnectAsync(int roomId, bool spectator, bool silent, CancellationToken cancellationToken = default);
}
