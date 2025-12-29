namespace client_win.Modules.Updates;

public sealed record UpdateInstallResult(
    bool Installed,
    bool RestartRequired,
    string StatusMessage);

