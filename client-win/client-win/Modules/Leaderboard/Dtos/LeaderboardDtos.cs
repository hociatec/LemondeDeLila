using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Leaderboard.Dtos;

public sealed class LeaderboardGamesPayload
{
    [JsonPropertyName("games")]
    public List<LeaderboardGameDto> Games { get; set; } = new();
}

public sealed class LeaderboardGameDto
{
    [JsonPropertyName("gameType")]
    public string GameType { get; set; } = string.Empty;

    [JsonPropertyName("gameName")]
    public string GameName { get; set; } = string.Empty;
}

public sealed class LeaderboardTopPayload
{
    [JsonPropertyName("gameType")]
    public string GameType { get; set; } = string.Empty;

    [JsonPropertyName("entries")]
    public List<LeaderboardEntryDto> Entries { get; set; } = new();
}

public sealed class LeaderboardEntryDto
{
    [JsonPropertyName("userId")]
    public int UserId { get; set; }

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("wins")]
    public int Wins { get; set; }

    [JsonPropertyName("losses")]
    public int Losses { get; set; }

    [JsonPropertyName("finished")]
    public int Finished { get; set; }

    [JsonPropertyName("quit")]
    public int Quit { get; set; }
}

