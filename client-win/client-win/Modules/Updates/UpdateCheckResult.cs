namespace client_win.Modules.Updates;

public sealed record UpdateCheckResult(
    bool IsUpdateAvailable,
    string? AvailableVersion,
    string StatusMessage);

