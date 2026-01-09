using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Game.Play.Actions.Dtos;

public sealed class GameClientAction
{
    public GameClientAction() { }

    public GameClientAction(string type, object? payload = null, object? meta = null)
    {
        Type = type;
        Payload = payload;
        Meta = meta;
    }

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("payload")]
    public object? Payload { get; set; }

    [JsonPropertyName("meta")]
    public object? Meta { get; set; }
}
