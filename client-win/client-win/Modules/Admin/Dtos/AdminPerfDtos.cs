using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminPerfEventSnapshotDto
{
    [JsonPropertyName("event")]
    public string Event { get; set; } = string.Empty;

    [JsonPropertyName("count")]
    public int Count { get; set; }

    [JsonPropertyName("avgMs")]
    public double AvgMs { get; set; }

    [JsonPropertyName("p95Ms")]
    public double P95Ms { get; set; }

    [JsonPropertyName("maxMs")]
    public double MaxMs { get; set; }

    [JsonPropertyName("clientToServerCount")]
    public int ClientToServerCount { get; set; }

    [JsonPropertyName("clientToServerAvgMs")]
    public double? ClientToServerAvgMs { get; set; }

    [JsonPropertyName("clientToServerP95Ms")]
    public double? ClientToServerP95Ms { get; set; }

    [JsonPropertyName("clientToServerMaxMs")]
    public double? ClientToServerMaxMs { get; set; }

    [JsonPropertyName("lastMs")]
    public double? LastMs { get; set; }

    [JsonPropertyName("lastAt")]
    public string? LastAt { get; set; }
}

public sealed class AdminPerfSnapshotDto
{
    [JsonPropertyName("generatedAt")]
    public string GeneratedAt { get; set; } = string.Empty;

    [JsonPropertyName("windowSeconds")]
    public int WindowSeconds { get; set; }

    [JsonPropertyName("events")]
    public List<AdminPerfEventSnapshotDto> Events { get; set; } = new();
}
