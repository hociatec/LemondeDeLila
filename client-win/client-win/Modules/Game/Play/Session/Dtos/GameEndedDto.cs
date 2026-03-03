using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Game.Play.Session.Dtos;

public sealed class GameEndedDto
{
    [JsonPropertyName("roomId")]
    public int RoomId { get; set; }

    [JsonPropertyName("gameType")]
    public string GameType { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("finishedAt")]
    public string FinishedAt { get; set; } = string.Empty;

    [JsonPropertyName("winnerPlayerId")]
    public int? WinnerPlayerId { get; set; }

    [JsonPropertyName("turnIndex")]
    public int? TurnIndex { get; set; }

    [JsonPropertyName("viewerPlayerId")]
    public int? ViewerPlayerId { get; set; }

    [JsonPropertyName("viewerOutcome")]
    public string? ViewerOutcome { get; set; }

    [JsonPropertyName("viewerEndgameMessage")]
    public string? ViewerEndgameMessage { get; set; }

    [JsonPropertyName("outcomesByPlayerId")]
    public Dictionary<string, string> OutcomesByPlayerId { get; set; } = new();

    [JsonPropertyName("playersById")]
    public Dictionary<string, string> PlayersById { get; set; } = new();
}
