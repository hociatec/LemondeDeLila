using System;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.RoomDirectory.Services;

public interface IRoomDirectoryClient
{
    Task<string> InviteSendAsync(int roomId, int userId, CancellationToken cancellationToken = default);
    Task<RoomInviteRespondResult> InviteRespondAsync(string invitationId, bool accept, CancellationToken cancellationToken = default);

    Task<PublicRoomsListedResult> PublicListAsync(string? gameType = null, CancellationToken cancellationToken = default);
    Task<PublicRoomsListedResult> PublicSubscribeAsync(string? gameType = null, CancellationToken cancellationToken = default);
    Task<bool> PublicUnsubscribeAsync(CancellationToken cancellationToken = default);
    IDisposable OnPublicRefresh(Action onRefresh);
}

public sealed class RoomInviteRespondResult
{
    public RoomInviteRespondResult(bool accepted, bool expired, int? roomId, bool spectator)
    {
        Accepted = accepted;
        Expired = expired;
        RoomId = roomId;
        Spectator = spectator;
    }

    public bool Accepted { get; }
    public bool Expired { get; }
    public int? RoomId { get; }
    public bool Spectator { get; }
}

public sealed class PublicRoomsListedResult
{
    public PublicRoomsListedResult(PublicRoomListItem[] items)
    {
        Items = items ?? Array.Empty<PublicRoomListItem>();
    }

    public PublicRoomListItem[] Items { get; }
}

public sealed class PublicRoomListItem
{
    public PublicRoomListItem(int id, string name, string gameType, string status, int maxPlayers, int playersCount, int botsCount, string? ownerUsername)
    {
        Id = id;
        Name = name ?? string.Empty;
        GameType = gameType ?? string.Empty;
        Status = status ?? string.Empty;
        MaxPlayers = maxPlayers;
        PlayersCount = playersCount;
        BotsCount = botsCount;
        OwnerUsername = ownerUsername;
    }

    public int Id { get; }
    public string Name { get; }
    public string GameType { get; }
    public string Status { get; }
    public int MaxPlayers { get; }
    public int PlayersCount { get; }
    public int BotsCount { get; }
    public string? OwnerUsername { get; }

    public string Slots => $"{PlayersCount + BotsCount}/{MaxPlayers}";

    public override string ToString()
    {
        var owner = string.IsNullOrWhiteSpace(OwnerUsername) ? "—" : OwnerUsername;
        var title = string.IsNullOrWhiteSpace(Name) ? $"Table #{Id}" : Name;
        var game = string.IsNullOrWhiteSpace(GameType) ? "unknown" : GameType;
        return $"{title} • {game} • {Slots} • {owner}";
    }
}
