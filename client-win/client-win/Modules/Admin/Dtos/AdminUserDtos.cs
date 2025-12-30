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

    [JsonPropertyName("chatBannedUntil")]
    public DateTime? ChatBannedUntil { get; set; }

    [JsonPropertyName("chatBanReason")]
    public string? ChatBanReason { get; set; }
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
