using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public interface IRoomGatewayClient
{
    Task<RoomSession> CreateAndConnectAsync(string gameType, CancellationToken cancellationToken = default);
    Task<RoomSession> ConnectAsync(int roomId, CancellationToken cancellationToken = default);
    Task<RoomSession> ConnectAsync(int roomId, bool spectator, CancellationToken cancellationToken = default);
}
