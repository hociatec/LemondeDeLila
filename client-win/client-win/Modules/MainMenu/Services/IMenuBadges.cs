namespace client_win.Modules.MainMenu.Services;

public interface IMenuBadges
{
    int UnreadNotifications { get; }
    int UnreadMessaging { get; }

    void SetUnreadNotifications(int count);
    void SetUnreadMessaging(int count);
}
