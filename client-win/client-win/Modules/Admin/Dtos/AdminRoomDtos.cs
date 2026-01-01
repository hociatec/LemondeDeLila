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
