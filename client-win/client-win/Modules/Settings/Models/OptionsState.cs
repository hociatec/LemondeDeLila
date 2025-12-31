namespace client_win.Modules.Settings.Models;

public sealed class OptionsState
{
    public bool MuteAll { get; set; } = false;
    public bool ConfirmExit { get; set; } = false;
    public bool SoundAppLaunch { get; set; } = true;
    public bool SoundBackground { get; set; } = true;
    public bool SoundNavigate { get; set; } = true;
    public bool SoundSelect { get; set; } = true;
    public bool SoundChatMessages { get; set; } = true;
    public int MusicVolume { get; set; } = 50;
    public int SoundAppLaunchVolume { get; set; } = 50;
    public int SoundBackgroundVolume { get; set; } = 50;
    public int SoundNavigateVolume { get; set; } = 50;
    public int SoundSelectVolume { get; set; } = 50;
    public int SoundChatMessagesVolume { get; set; } = 50;

    // Overrides de sons (stockés dans AppData), pour permettre la personnalisation sans casser ClickOnce.
    public string? SoundRoomOpenedPath { get; set; }
    public string? SoundRoomExitPath { get; set; }

    public bool ChatEnabled { get; set; } = true;
    public bool ConfirmChatExit { get; set; }

    public bool StayConnected { get; set; } = true;
    public bool ExtraDescriptions { get; set; }

    public string CurrentVersion { get; set; } = "unknown";
}
