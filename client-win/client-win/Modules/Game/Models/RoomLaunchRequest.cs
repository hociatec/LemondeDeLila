namespace client_win.Modules.Game.Models;

public sealed class RoomLaunchRequest
{
    public RoomLaunchRequest(int roomId, string gameType, string roomName, bool spectator)
    {
        RoomId = roomId;
        GameType = gameType ?? string.Empty;
        RoomName = roomName ?? string.Empty;
        Spectator = spectator;
    }

    public int RoomId { get; }
    public string GameType { get; }
    public string RoomName { get; }
    public bool Spectator { get; }
}
