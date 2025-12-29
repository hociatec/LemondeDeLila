using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminUserDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("roles")]
    public List<string>? Roles { get; set; }

    [JsonPropertyName("bannedUntil")]
    public DateTime? BannedUntil { get; set; }

    [JsonPropertyName("banReason")]
    public string? BanReason { get; set; }
}

public sealed class AdminUsersListResponseDto
{
  [JsonPropertyName("items")]
    public List<AdminUserDto> Items { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("page")]
    public int Page { get; set; }

  [JsonPropertyName("limit")]
  public int Limit { get; set; }
}

public sealed class AdminUserResponseDto
{
  [JsonPropertyName("user")]
  public AdminUserDto? User { get; set; }
}

public sealed class AdminRolesListResponseDto
{
    [JsonPropertyName("roles")]
    public List<string> Roles { get; set; } = new();
}

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
}

public sealed class AdminBroadcastResponseDto
{
  [JsonPropertyName("delivered")]
  public int Delivered { get; set; }
}

public sealed class AdminLogsDownloadResponseDto
{
  [JsonPropertyName("file")]
    public string File { get; set; } = string.Empty;

    [JsonPropertyName("lines")]
    public List<string> Lines { get; set; } = new();

  [JsonPropertyName("total")]
  public int Total { get; set; }
}

public sealed class AdminRoleDefinitionDto
{
  [JsonPropertyName("name")]
  public string Name { get; set; } = string.Empty;

  [JsonPropertyName("description")]
  public string Description { get; set; } = string.Empty;

  [JsonPropertyName("permissions")]
  public List<string> Permissions { get; set; } = new();
}

public sealed class AdminRoleDefinitionsResponseDto
{
  [JsonPropertyName("definitions")]
  public List<AdminRoleDefinitionDto> Definitions { get; set; } = new();
}
