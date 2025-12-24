using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Models;

namespace client_win.Modules.Game.Services;

public interface IRoomRealtimeService
{
    Task<CreatedRoom?> CreateRoomAsync(CreateRoomRequest request, CancellationToken cancellationToken = default);
}
