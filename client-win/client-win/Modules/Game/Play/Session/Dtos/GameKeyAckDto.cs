namespace client_win.Modules.Game.Play.Session.Dtos;

public sealed class GameKeyAckDto
{
    public required string Key { get; init; }
    public required bool Ok { get; init; }
    public string? PanelId { get; init; }
    public string? Message { get; init; }
    public string? RoomOp { get; init; }
}
