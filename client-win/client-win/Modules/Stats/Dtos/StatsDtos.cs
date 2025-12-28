using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Stats.Dtos;

public sealed class MyStatsPayload
{
    [JsonPropertyName("games")]
    public List<MyGameStatsDto> Games { get; set; } = new();
}

public sealed class MyGameStatsDto
{
    [JsonPropertyName("gameType")]
    public string GameType { get; set; } = string.Empty;

    [JsonPropertyName("gameName")]
    public string GameName { get; set; } = string.Empty;

    [JsonPropertyName("withBots")]
    public StatsCountsDto WithBots { get; set; } = new();

    [JsonPropertyName("withoutBots")]
    public StatsCountsDto WithoutBots { get; set; } = new();
}

public sealed class StatsCountsDto
{
    [JsonPropertyName("finished")]
    public int Finished { get; set; }

    [JsonPropertyName("quit")]
    public int Quit { get; set; }

    [JsonPropertyName("won")]
    public int Won { get; set; }

    [JsonPropertyName("lost")]
    public int Lost { get; set; }
}

