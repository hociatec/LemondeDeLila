using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace client_win.Modules.Game.Play.Dtos;

public sealed class GameStateDto
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("phase")]
    public string Phase { get; set; } = string.Empty;

    [JsonPropertyName("round")]
    public int Round { get; set; }

    [JsonPropertyName("turnIndex")]
    public int TurnIndex { get; set; }

    [JsonPropertyName("lastRoll")]
    public int? LastRoll { get; set; }

    [JsonPropertyName("log")]
    public List<GameLogEntryDto> Log { get; set; } = new();

    [JsonPropertyName("players")]
    public List<GamePlayerDto>? Players { get; set; }

    [JsonPropertyName("turn")]
    public GameTurnDto? Turn { get; set; }

    [JsonPropertyName("metadata")]
    public JsonElement Metadata { get; set; }

    [JsonPropertyName("pending")]
    public GamePendingDto? Pending { get; set; }

    [JsonPropertyName("botThinking")]
    public bool BotThinking { get; set; }

    [JsonPropertyName("actions")]
    public List<GameAvailableActionDto>? Actions { get; set; }

    [JsonPropertyName("extras")]
    public JsonElement Extras { get; set; }

    [JsonPropertyName("board")]
    public GameBoardDto? Board { get; set; }
}

public sealed class GameBoardDto
{
    [JsonPropertyName("tiles")]
    public JsonElement Tiles { get; set; }

    [JsonPropertyName("positions")]
    public Dictionary<string, int>? Positions { get; set; }

    [JsonPropertyName("laps")]
    public Dictionary<string, int>? Laps { get; set; }
}

public sealed class GameLogEntryDto
{
    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }
}

public sealed class GameTurnDto
{
    [JsonPropertyName("currentPlayerId")]
    public int? CurrentPlayerId { get; set; }

    [JsonPropertyName("direction")]
    public int Direction { get; set; }

    [JsonPropertyName("skippedPlayerIds")]
    public List<int>? SkippedPlayerIds { get; set; }

    [JsonPropertyName("label")]
    public string? Label { get; set; }
}

public sealed class GamePlayerDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("isBot")]
    public bool? IsBot { get; set; }

    [JsonPropertyName("basket")]
    public JsonElement Basket { get; set; }

    [JsonPropertyName("inventory")]
    public JsonElement Inventory { get; set; }

    [JsonPropertyName("shoppingList")]
    public JsonElement ShoppingList { get; set; }
}

public sealed class GamePendingDto
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("label")]
    public string? Label { get; set; }

    [JsonPropertyName("playerId")]
    public int? PlayerId { get; set; }

    [JsonPropertyName("targetPlayerId")]
    public int? TargetPlayerId { get; set; }

    [JsonPropertyName("blocking")]
    public bool? Blocking { get; set; }

    [JsonPropertyName("question")]
    public string? Question { get; set; }

    [JsonPropertyName("choices")]
    public List<string>? Choices { get; set; }

    [JsonPropertyName("data")]
    public JsonElement Data { get; set; }
}

public sealed class GameAvailableActionDto
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("label")]
    public string? Label { get; set; }

    [JsonPropertyName("payload")]
    public JsonElement Payload { get; set; }
}
