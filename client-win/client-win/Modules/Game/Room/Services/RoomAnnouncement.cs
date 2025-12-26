namespace client_win.Modules.Game.Room.Services;

public enum RoomAnnouncementKind
{
    Polite,
    Assertive
}

public sealed record RoomAnnouncement(RoomAnnouncementKind Kind, string Message);
