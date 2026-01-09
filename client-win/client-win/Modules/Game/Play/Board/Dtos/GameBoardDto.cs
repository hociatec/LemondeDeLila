using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace client_win.Modules.Game.Play.Board.Dtos;

public sealed class GameBoardDto
{
    [JsonPropertyName("tiles")]
    public JsonElement Tiles { get; set; }

    [JsonPropertyName("positions")]
    public Dictionary<string, int>? Positions { get; set; }

    [JsonPropertyName("laps")]
    public Dictionary<string, int>? Laps { get; set; }
}
