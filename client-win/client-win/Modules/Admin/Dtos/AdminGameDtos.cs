using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminGameDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("category")]
    public string? Category { get; set; }

    [JsonPropertyName("subcategory")]
    public string? Subcategory { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("minPlayers")]
    public int? MinPlayers { get; set; }

    [JsonPropertyName("maxPlayers")]
    public int? MaxPlayers { get; set; }

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; }

    [JsonPropertyName("chatEnabled")]
    public bool ChatEnabled { get; set; } = true;

    [JsonPropertyName("categoryId")]
    public string? CategoryId { get; set; }
}

public sealed class AdminGamesListResponseDto
{
    [JsonPropertyName("games")]
    public List<AdminGameDto> Games { get; set; } = new();
}

public sealed class AdminGameCategoryDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("parentId")]
    public string? ParentId { get; set; }
}

public sealed class AdminGameCategoriesResponseDto
{
    [JsonPropertyName("categories")]
    public List<AdminGameCategoryDto> Categories { get; set; } = new();

    [JsonPropertyName("assignments")]
    public Dictionary<string, string?> Assignments { get; set; } = new();
}
