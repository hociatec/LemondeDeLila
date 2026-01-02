namespace client_win.Modules.Settings.Models;

public sealed class OptionsState
{
    public bool MuteAll { get; set; } = false;
    public bool ConfirmExit { get; set; } = false;
    public bool SoundAppLaunch { get; set; } = true;
    public bool SoundNavigate { get; set; } = true;
    public bool SoundSelect { get; set; } = true;
    public bool SoundChatMessages { get; set; } = true;
    public int SoundAppLaunchVolume { get; set; } = 50;
    public int SoundNavigateVolume { get; set; } = 50;
    public int SoundSelectVolume { get; set; } = 50;
    public int SoundChatMessagesVolume { get; set; } = 50;

    // Overrides de sons (stockés dans AppData), pour permettre la personnalisation sans casser ClickOnce.
    public string? SoundRoomOpenedPath { get; set; }
    public string? SoundRoomJoinedPath { get; set; }
    public string? SoundRoomExitPath { get; set; }
    public string? SoundInvitationSentPath { get; set; }
    public string? SoundInvitationReceivedPath { get; set; }
    public string? SoundFriendConnectedPath { get; set; }
    public string? SoundFriendDisconnectedPath { get; set; }
    public string? SoundFriendInvitationSentPath { get; set; }
    public string? SoundFriendInvitationReceivedPath { get; set; }
    public string? SoundChatMessageSentPath { get; set; }
    public string? SoundChatMessageReceivedPath { get; set; }
    public string? SoundPrivateMessageSentPath { get; set; }
    public string? SoundPrivateMessageReceivedPath { get; set; }
    public string? SoundClientOpenedPath { get; set; }
    public string? SoundClientConnectedPath { get; set; }
    public string? SoundClientDisconnectedPath { get; set; }

    public bool ChatEnabled { get; set; } = true;
    public bool ConfirmChatExit { get; set; }
    public int AdminChatModerationLoadLimit { get; set; } = 200;

    public string CurrentVersion { get; set; } = "unknown";
}
