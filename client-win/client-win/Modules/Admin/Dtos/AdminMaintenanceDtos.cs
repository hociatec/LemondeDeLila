using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminMaintenanceStartDeployResponse
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("unit")]
    public string? Unit { get; set; }
}

public sealed class AdminMaintenanceUnitStatusResponse
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("unit")]
    public string? Unit { get; set; }

    // From systemctl show output (PascalCase fields from backend keys).
    public string? ActiveState { get; set; }
    public string? SubState { get; set; }
    public string? Result { get; set; }
    public string? ExecMainStatus { get; set; }
    public string? ExecMainCode { get; set; }
    public string? ExecMainStartTimestamp { get; set; }
    public string? ExecMainExitTimestamp { get; set; }
}

public sealed class AdminMaintenanceLogsResponse
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("unit")]
    public string? Unit { get; set; }

    [JsonPropertyName("tail")]
    public int Tail { get; set; }

    [JsonPropertyName("logs")]
    public string? Logs { get; set; }
}

