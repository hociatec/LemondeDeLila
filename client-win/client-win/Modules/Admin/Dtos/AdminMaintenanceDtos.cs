namespace client_win.Modules.Admin.Dtos;

public sealed class AdminMaintenanceDeployResponseDto
{
    public bool Ok { get; set; }
    public string Unit { get; set; } = string.Empty;
}

public sealed class AdminMaintenanceUnitStatusDto
{
    public bool Ok { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string? Id { get; set; }
    public string? ActiveState { get; set; }
    public string? SubState { get; set; }
    public string? Result { get; set; }
    public string? ExecMainStatus { get; set; }
    public string? ExecMainCode { get; set; }
    public string? ExecMainStartTimestamp { get; set; }
    public string? ExecMainExitTimestamp { get; set; }
}

public sealed class AdminMaintenanceLogsDto
{
    public bool Ok { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int Tail { get; set; }
    public string Logs { get; set; } = string.Empty;
}

