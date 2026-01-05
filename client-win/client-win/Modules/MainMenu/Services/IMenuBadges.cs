namespace client_win.Modules.MainMenu.Services;

public interface IMenuBadges
{
    int UnreadNotifications { get; }
    int UnreadMessaging { get; }

    void IncrementNotifications();
    void ResetNotifications();

    void IncrementMessaging();
    void ResetMessaging();
}

