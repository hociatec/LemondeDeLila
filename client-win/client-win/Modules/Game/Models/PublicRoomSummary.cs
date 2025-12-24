namespace client_win.Modules.Game.Models;

public sealed class PublicRoomSummary
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GameType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int MaxPlayers { get; set; }
    public int PlayersCount { get; set; }
    public int BotsCount { get; set; }
    public string OwnerUsername { get; set; } = string.Empty;

    public override string ToString() => $"{Name} ({PlayersCount}/{MaxPlayers})";
}
