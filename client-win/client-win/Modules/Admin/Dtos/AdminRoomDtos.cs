using System;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminRoomsCleanupResponseDto
{
    public int Matched { get; set; }
    public int Deleted { get; set; }
    public int[] RoomIds { get; set; } = Array.Empty<int>();
}
