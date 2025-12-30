using System;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminChatMessagesResponseDto
{
    [JsonPropertyName("messages")]
    public AdminChatMessageDto[] Messages { get; set; } = Array.Empty<AdminChatMessageDto>();
}

public sealed class AdminChatMessageDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("deletedAt")]
    public DateTime? DeletedAt { get; set; }

    [JsonPropertyName("user")]
    public AdminChatUserDto User { get; set; } = new();
}

public sealed class AdminChatUserDto
{
    [JsonPropertyName("id")]
    public int? Id { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }

    [JsonPropertyName("avatar")]
    public string? Avatar { get; set; }

    [JsonPropertyName("chatBannedUntil")]
    public DateTime? ChatBannedUntil { get; set; }

    [JsonPropertyName("chatBanReason")]
    public string? ChatBanReason { get; set; }
}

public sealed class AdminChatDeleteResponseDto
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }
}

public sealed class AdminChatClearResponseDto
{
    [JsonPropertyName("deleted")]
    public int Deleted { get; set; }
}

public sealed class AdminChatBanResponseDto
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("userId")]
    public int UserId { get; set; }

    [JsonPropertyName("chatBannedUntil")]
    public DateTime? ChatBannedUntil { get; set; }

    [JsonPropertyName("chatBanReason")]
    public string? ChatBanReason { get; set; }
}

public sealed class AdminChatUnbanResponseDto
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("userId")]
    public int UserId { get; set; }
}

