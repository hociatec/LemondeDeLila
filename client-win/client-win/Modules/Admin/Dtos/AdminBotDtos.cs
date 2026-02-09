using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminBotNameDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; }

    [JsonPropertyName("createdAt")]
    public string? CreatedAt { get; set; }
}

public sealed class AdminBotNamesListResponseDto
{
    [JsonPropertyName("names")]
    public List<AdminBotNameDto> Names { get; set; } = new();
}

public sealed class AdminBotSettingsDto
{
    [JsonPropertyName("botTurnDelayMs")]
    public int BotTurnDelayMs { get; set; }

    [JsonPropertyName("botStartDelayMs")]
    public int BotStartDelayMs { get; set; }

    [JsonPropertyName("botDrawDelayMs")]
    public int BotDrawDelayMs { get; set; }
}
