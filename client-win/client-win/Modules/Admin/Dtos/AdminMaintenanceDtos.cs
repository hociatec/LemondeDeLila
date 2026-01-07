using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

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

public sealed class AdminMaintenanceCommandResponse
{
    public bool Ok { get; set; }

    public string? Command { get; set; }

    public int Status { get; set; }

    public string? Stdout { get; set; }

    public string? Stderr { get; set; }

    public string? Error { get; set; }
}

public sealed class AdminMaintenanceRestartResponse
{
    public bool Ok { get; set; }

    public string? Service { get; set; }

    public bool Scheduled { get; set; }
}

public sealed class AdminMaintenanceHealthResponse
{
    public bool Ok { get; set; }

    public string? Url { get; set; }

    public int StatusCode { get; set; }

    public string? Body { get; set; }
}
