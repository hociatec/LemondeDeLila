namespace client_win.Modules.Game.Models;

public sealed class CreateRoomRequest
{
    public CreateRoomRequest(string gameType, string? name, int maxPlayers, bool isPrivate)
    {
        GameType = gameType ?? string.Empty;
        Name = name ?? string.Empty;
        MaxPlayers = maxPlayers;
        IsPrivate = isPrivate;
    }

    public string GameType { get; }
    public string Name { get; }
    public int MaxPlayers { get; }
    public bool IsPrivate { get; }
}
