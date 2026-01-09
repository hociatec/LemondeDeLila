using System.Text.Json.Serialization;

namespace client_win.Modules.Game.Play.State.Dtos;

public sealed class TurnInfoDto
{
    [JsonPropertyName("roomId")]
    public int RoomId { get; set; }

    [JsonPropertyName("gameType")]
    public string GameType { get; set; } = string.Empty;

    [JsonPropertyName("turnIndex")]
    public int? TurnIndex { get; set; }

    [JsonPropertyName("currentPlayerId")]
    public int? CurrentPlayerId { get; set; }

    [JsonPropertyName("currentPlayerUsername")]
    public string? CurrentPlayerUsername { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("phase")]
    public string? Phase { get; set; }
}
