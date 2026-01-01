using System;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminRoomsCleanupResponseDto
{
    public int Matched { get; set; }
    public int Deleted { get; set; }
    public int[] RoomIds { get; set; } = Array.Empty<int>();
}

public sealed class AdminRoomsDestroyResponseDto
{
    public bool Ok { get; set; }
    public int RoomId { get; set; }
}

public sealed class AdminRoomMaintenanceSettingsDto
{
    public bool AutoCleanupEnabled { get; set; }
    public int AutoCleanupOlderThanMinutes { get; set; }
    public int AutoCleanupIntervalSeconds { get; set; }
    public int AutoCleanupLimit { get; set; }

    public override string ToString()
    {
        return $"enabled={AutoCleanupEnabled} olderThan={AutoCleanupOlderThanMinutes}m interval={AutoCleanupIntervalSeconds}s limit={AutoCleanupLimit}";
    }
}

public sealed class AdminRoomsListResponseDto
{
    public AdminRoomListItemDto[] Items { get; set; } = Array.Empty<AdminRoomListItemDto>();
}

public sealed class AdminRoomListItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GameType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public int MaxPlayers { get; set; }
    public int PlayersCount { get; set; }
    public int BotsCount { get; set; }
    public string? OwnerUsername { get; set; }
    public int ActivePlayers { get; set; }

    public string Slots => $"{PlayersCount + BotsCount}/{MaxPlayers}";

    public override string ToString()
    {
        var visibility = IsPrivate ? "privée" : "publique";
        var owner = string.IsNullOrWhiteSpace(OwnerUsername) ? "—" : OwnerUsername;
        var title = string.IsNullOrWhiteSpace(Name) ? $"Table #{Id}" : Name;
        var game = string.IsNullOrWhiteSpace(GameType) ? "unknown" : GameType;
        var active = ActivePlayers > 0 ? $" • actifs:{ActivePlayers}" : string.Empty;
        return $"{title} • {game} • {visibility} • {Slots} • {owner}{active}";
    }
}
