using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Models;

namespace client_win.Modules.Game.Services;

public interface IRoomDirectoryService
{
    Task<IReadOnlyList<PublicRoomSummary>> ListPublicRoomsAsync(string? gameType, CancellationToken cancellationToken = default);
    Task<JoinedRoom?> JoinPublicRoomAsync(int roomId, CancellationToken cancellationToken = default);
}
