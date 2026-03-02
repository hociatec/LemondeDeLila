namespace client_win.Modules.Admin.Dtos;

public sealed class AdminTableAmbienceDto
{
    public string SoundId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;

    public override string ToString() => $"{Name} ({SoundId})";
}
