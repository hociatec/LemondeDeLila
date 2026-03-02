namespace client_win.Modules.Game.Room.Services;

public sealed class RoomChatMessageDto
{
    public long Seq { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}
