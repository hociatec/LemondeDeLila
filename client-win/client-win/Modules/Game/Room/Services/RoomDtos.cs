using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomPayloadDto
{
    [JsonPropertyName("manifest")]
    public GameManifestDto? Manifest { get; set; }

    [JsonPropertyName("room")]
    public RoomDto Room { get; set; } = new();

    [JsonPropertyName("generatedAt")]
    public string GeneratedAt { get; set; } = string.Empty;
}

public sealed class GameManifestDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("minPlayers")]
    public int MinPlayers { get; set; }

    [JsonPropertyName("maxPlayers")]
    public int MaxPlayers { get; set; }

    [JsonPropertyName("chatEnabled")]
    public bool ChatEnabled { get; set; } = true;

    [JsonPropertyName("chatSoundsEnabled")]
    public bool ChatSoundsEnabled { get; set; } = true;
}

public sealed class RoomDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("isPrivate")]
    public bool IsPrivate { get; set; }

    [JsonPropertyName("maxPlayers")]
    public int MaxPlayers { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("gameType")]
    public string GameType { get; set; } = string.Empty;

    [JsonPropertyName("startedAt")]
    public string? StartedAt { get; set; }

    [JsonPropertyName("tableAmbienceSoundId")]
    public string? TableAmbienceSoundId { get; set; }

    [JsonPropertyName("counts")]
    public RoomCountsDto Counts { get; set; } = new();

    [JsonPropertyName("owner")]
    public RoomUserDto? Owner { get; set; }

    [JsonPropertyName("players")]
    public List<RoomUserDto> Players { get; set; } = new();

    [JsonPropertyName("spectators")]
    public List<RoomUserDto> Spectators { get; set; } = new();

    [JsonPropertyName("bots")]
    public List<RoomBotDto> Bots { get; set; } = new();
}

public sealed class RoomCountsDto
{
    [JsonPropertyName("players")]
    public int Players { get; set; }

    [JsonPropertyName("spectators")]
    public int Spectators { get; set; }
}

public sealed class RoomUserDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;
}

public sealed class RoomBotDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

internal sealed class RoomEnvelope<TPayload>
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("roomId")]
    public int RoomId { get; set; }

    [JsonPropertyName("payload")]
    public TPayload? Payload { get; set; }

    [JsonPropertyName("requestId")]
    public string? RequestId { get; set; }
}
