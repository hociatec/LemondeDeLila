namespace client_win.Modules.Game.Models;

public sealed class RoomSnapshot
{
    public int RoomId { get; set; }
    public string GameType { get; set; } = string.Empty;
    public string RoomName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string OwnerUsername { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public bool IsSpectator { get; set; }
    public int PlayersCount { get; set; }
    public int BotsCount { get; set; }
    public int SpectatorsCount { get; set; }
    public List<int> BotIds { get; set; } = new();
    public List<string> PlayerNames { get; set; } = new();
    public List<string> BotNames { get; set; } = new();
}
