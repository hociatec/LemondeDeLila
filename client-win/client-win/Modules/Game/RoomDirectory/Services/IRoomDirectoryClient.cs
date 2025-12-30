using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.RoomDirectory.Services;

public interface IRoomDirectoryClient
{
    Task<string> InviteSendAsync(int roomId, int userId, CancellationToken cancellationToken = default);
    Task<RoomInviteRespondResult> InviteRespondAsync(string invitationId, bool accept, CancellationToken cancellationToken = default);
}

public sealed class RoomInviteRespondResult
{
    public RoomInviteRespondResult(bool accepted, bool expired, int? roomId)
    {
        Accepted = accepted;
        Expired = expired;
        RoomId = roomId;
    }

    public bool Accepted { get; }
    public bool Expired { get; }
    public int? RoomId { get; }
}

