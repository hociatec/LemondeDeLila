namespace client_win.Modules.Game.Models;

public sealed class JoinedRoom
{
    public JoinedRoom(int roomId, string gameType, string roomName)
    {
        RoomId = roomId;
        GameType = gameType ?? string.Empty;
        RoomName = roomName ?? string.Empty;
    }

    public int RoomId { get; }
    public string GameType { get; }
    public string RoomName { get; }
}
