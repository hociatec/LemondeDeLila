using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public interface IRoomGatewayClient
{
    Task<RoomSession> CreateAndConnectAsync(string gameType, CancellationToken cancellationToken = default);
}
