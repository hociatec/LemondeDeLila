using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Catalog.Models;

public sealed class CatalogGame
{
    public CatalogGame() { }

    public CatalogGame(string code, string name, string summary, int minPlayers, int maxPlayers, string engine, IEnumerable<string> categories)
    {
        Code = code;
        Name = name;
        Summary = summary;
        MinPlayers = minPlayers;
        MaxPlayers = maxPlayers;
        Engine = engine;
        Categories = new List<string>(categories ?? new List<string>());
    }

    [JsonIgnore]
    public string Code { get; set; } = string.Empty;

    // Backend WS `catalog.*` renvoie `id` (le client Java accepte aussi `code`).
    // On mappe `id`/`code` -> Code pour que la création de table (`room.create`) envoie un gameType valide.
    [JsonPropertyName("id")]
    public string Id
    {
        get => Code;
        set => Code = value ?? string.Empty;
    }

    [JsonPropertyName("code")]
    public string LegacyCode
    {
        get => Code;
        set => Code = value ?? string.Empty;
    }
    public string Name { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public int MinPlayers { get; set; }
    public int MaxPlayers { get; set; }
    public string Engine { get; set; } = string.Empty;
    public List<string> Categories { get; set; } = new();

    [JsonPropertyName("status")]
    public string Status { get; set; } = "finished";

    [JsonIgnore]
    public string DisplayName
    {
        get
        {
            var name = Name ?? string.Empty;
            var status = (Status ?? string.Empty).Trim().ToLowerInvariant();
            return status switch
            {
                "beta" => $"{name} (Bêta)",
                "construction" => $"{name} (En construction)",
                _ => name
            };
        }
    }

    [JsonPropertyName("chatEnabled")]
    public bool ChatEnabled { get; set; } = true;

    [JsonPropertyName("chatSoundsEnabled")]
    public bool ChatSoundsEnabled { get; set; } = true;

    public override string ToString() => Name;
}
