namespace client_win.Modules.Game.Shell.Models;

public sealed record RoomStartWizardIntent(
    int? OwnerId,
    string Title,
    string Description,
    string? Message);
