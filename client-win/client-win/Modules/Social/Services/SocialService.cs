using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Error;
using client_win.Modules.Network;
using client_win.Modules.Social.Models;
using client_win.Modules.User.Services;

namespace client_win.Modules.Social.Services;

public sealed class SocialService : ISocialService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;
    private readonly ErrorBus? _errors;

    public SocialService(WsRequestClient ws, ISessionService session, ErrorBus? errors = null)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _errors = errors;
    }

    public async Task<IReadOnlyList<SocialUser>> GetFriendsAsync(CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ListPayload>(
            WsMessageTypes.Social.FriendsList,
            new { },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return MapUsers(response, WsMessageTypes.Social.FriendsList);
    }

    public async Task<IReadOnlyList<SocialFriendRequest>> GetRequestsAsync(string direction, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<RequestsPayload>(
            WsMessageTypes.Social.FriendsRequests,
            new { direction },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload?.Items == null)
        {
            PublishError(response.Error ?? "Chargement des demandes impossible.", WsMessageTypes.Social.FriendsRequests);
            return Array.Empty<SocialFriendRequest>();
        }

        return response.Payload.Items.Select(MapRequest).ToList();
    }

    public async Task<IReadOnlyList<SocialUser>> GetBlockedAsync(CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ListPayload>(
            WsMessageTypes.Social.FriendsBlocked,
            new { },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return MapUsers(response, WsMessageTypes.Social.FriendsBlocked);
    }

    public async Task<bool> RequestFriendAsync(int userId, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ActionPayload>(
            WsMessageTypes.Social.FriendsRequest,
            new { userId },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return response.Success;
    }

    public async Task<bool> AcceptFriendAsync(int userId, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ActionPayload>(
            WsMessageTypes.Social.FriendsAccept,
            new { userId },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return response.Success;
    }

    public async Task<bool> RejectFriendAsync(int userId, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ActionPayload>(
            WsMessageTypes.Social.FriendsReject,
            new { userId },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return response.Success;
    }

    public async Task<bool> CancelRequestAsync(int userId, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ActionPayload>(
            WsMessageTypes.Social.FriendsCancel,
            new { userId },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return response.Success;
    }

    public async Task<bool> RemoveFriendAsync(int userId, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ActionPayload>(
            WsMessageTypes.Social.FriendsRemove,
            new { userId },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return response.Success;
    }

    public async Task<bool> BlockUserAsync(int userId, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ActionPayload>(
            WsMessageTypes.Social.FriendsBlock,
            new { userId },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return response.Success;
    }

    public async Task<bool> UnblockUserAsync(int userId, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ActionPayload>(
            WsMessageTypes.Social.FriendsUnblock,
            new { userId },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        return response.Success;
    }

    public async Task<SocialProfile?> GetProfileAsync(int? userId = null, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ProfilePayload>(
            WsMessageTypes.Social.ProfileGet,
            new { userId },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload?.Profile == null)
        {
            PublishError(response.Error ?? "Chargement du profil impossible.", WsMessageTypes.Social.ProfileGet);
            return null;
        }

        return MapProfile(response.Payload.Profile);
    }

    public async Task<SocialProfile?> UpdateProfileAsync(string? bio, string? visibility, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<ProfilePayload>(
            WsMessageTypes.Social.ProfileUpdate,
            new { bio, visibility },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload?.Profile == null)
        {
            PublishError(response.Error ?? "Mise a jour du profil impossible.", WsMessageTypes.Social.ProfileUpdate);
            return null;
        }

        return MapProfile(response.Payload.Profile);
    }

    public async Task<IReadOnlyList<SocialUser>> SearchUsersAsync(string query, CancellationToken cancellationToken = default)
    {
        var response = await _ws.RequestAsync<SearchPayload>(
            WsMessageTypes.Social.UserSearch,
            new { query },
            _session.CurrentUser?.Token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload?.Items == null)
        {
            PublishError(response.Error ?? "Recherche impossible.", WsMessageTypes.Social.UserSearch);
            return Array.Empty<SocialUser>();
        }

        return response.Payload.Items.Select(MapUser).ToList();
    }

    private IReadOnlyList<SocialUser> MapUsers(WsResponse<ListPayload> response, string context)
    {
        if (!response.Success || response.Payload?.Items == null)
        {
            PublishError(response.Error ?? "Chargement social impossible.", context);
            return Array.Empty<SocialUser>();
        }

        return response.Payload.Items.Select(MapUser).ToList();
    }

    private static SocialUser MapUser(UserDto dto)
    {
        return new SocialUser
        {
            Id = dto.Id,
            Username = dto.Username ?? string.Empty,
            Avatar = dto.Avatar,
            Since = dto.Since,
            CreatedAt = dto.CreatedAt,
            BlockedAt = dto.BlockedAt
        };
    }

    private static SocialFriendRequest MapRequest(RequestDto dto)
    {
        return new SocialFriendRequest
        {
            Id = dto.Id,
            Requester = MapUser(dto.Requester ?? new UserDto()),
            Addressee = MapUser(dto.Addressee ?? new UserDto()),
            CreatedAt = dto.CreatedAt
        };
    }

    private static SocialProfile MapProfile(ProfileDto dto)
    {
        return new SocialProfile
        {
            User = MapUser(dto.User ?? new UserDto()),
            Bio = dto.Bio ?? string.Empty,
            Visibility = dto.Visibility ?? "public",
            CreatedAt = dto.CreatedAt,
            UpdatedAt = dto.UpdatedAt,
            IsOwner = dto.IsOwner
        };
    }

    private void PublishError(string message, string context)
    {
        _errors?.Publish(new AppError(message, ErrorSeverity.Error, context: context));
    }

    private sealed class ListPayload
    {
        public List<UserDto>? Items { get; set; }
    }

    private sealed class RequestsPayload
    {
        public List<RequestDto>? Items { get; set; }
    }

    private sealed class SearchPayload
    {
        public List<UserDto>? Items { get; set; }
    }

    private sealed class ProfilePayload
    {
        public ProfileDto? Profile { get; set; }
    }

    private sealed class ActionPayload
    {
        public bool Removed { get; set; }
    }

    private sealed class UserDto
    {
        public int Id { get; set; }
        public string? Username { get; set; }
        public string? Avatar { get; set; }
        public DateTime? Since { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? BlockedAt { get; set; }
    }

    private sealed class RequestDto
    {
        public int Id { get; set; }
        public UserDto? Requester { get; set; }
        public UserDto? Addressee { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    private sealed class ProfileDto
    {
        public UserDto? User { get; set; }
        public string? Bio { get; set; }
        public string? Visibility { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsOwner { get; set; }
    }
}
