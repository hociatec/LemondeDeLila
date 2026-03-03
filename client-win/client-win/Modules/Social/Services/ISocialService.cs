using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Social.Models;

namespace client_win.Modules.Social.Services;

public interface ISocialService
{
    Task<IReadOnlyList<SocialUser>> GetFriendsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SocialFriendRequest>> GetRequestsAsync(string direction, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SocialUser>> GetBlockedAsync(CancellationToken cancellationToken = default);
    Task<bool> RequestFriendAsync(int userId, CancellationToken cancellationToken = default);
    Task<bool> AcceptFriendAsync(int userId, CancellationToken cancellationToken = default);
    Task<bool> RejectFriendAsync(int userId, CancellationToken cancellationToken = default);
    Task<bool> CancelRequestAsync(int userId, CancellationToken cancellationToken = default);
    Task<bool> RemoveFriendAsync(int userId, CancellationToken cancellationToken = default);
    Task<bool> BlockUserAsync(int userId, CancellationToken cancellationToken = default);
    Task<bool> UnblockUserAsync(int userId, CancellationToken cancellationToken = default);
    Task<SocialProfile?> GetProfileAsync(int? userId = null, CancellationToken cancellationToken = default);
    Task<SocialProfile?> UpdateProfileAsync(
        string? bio,
        string? victoryMessage,
        string? defeatMessage,
        string? visibility,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SocialUser>> SearchUsersAsync(string query, CancellationToken cancellationToken = default);
}
