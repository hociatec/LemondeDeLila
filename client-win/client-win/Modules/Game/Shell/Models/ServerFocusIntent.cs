namespace client_win.Modules.Game.Shell.Models;

public sealed record ServerFocusIntent(
    ServerFocusRegion Region,
    string? Reason = null,
    ServerFocusPriority Priority = ServerFocusPriority.Default);

public enum ServerFocusRegion
{
    GameZone,
    History,
    Chat,
}

public enum ServerFocusPriority
{
    Default,
    Assertive,
}
