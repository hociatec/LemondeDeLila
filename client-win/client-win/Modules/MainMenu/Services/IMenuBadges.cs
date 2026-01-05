namespace client_win.Modules.MainMenu.Services;

public interface IMenuBadges
{
    int UnreadNotifications { get; }
    int UnreadMessaging { get; }

    void AddUnreadNotification(string id);
    void MarkNotificationRead(string id);

    void AddUnreadMessage(string id);
    void MarkMessageRead(string id);
}
