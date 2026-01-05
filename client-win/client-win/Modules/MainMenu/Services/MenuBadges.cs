using client_win.Core;

namespace client_win.Modules.MainMenu.Services;

public sealed class MenuBadges : ObservableObject, IMenuBadges
{
    private int _unreadNotifications;
    private int _unreadMessaging;

    public int UnreadNotifications
    {
        get => _unreadNotifications;
        private set => SetProperty(ref _unreadNotifications, value);
    }

    public int UnreadMessaging
    {
        get => _unreadMessaging;
        private set => SetProperty(ref _unreadMessaging, value);
    }

    public void IncrementNotifications() => UnreadNotifications = UnreadNotifications + 1;

    public void ResetNotifications() => UnreadNotifications = 0;

    public void IncrementMessaging() => UnreadMessaging = UnreadMessaging + 1;

    public void ResetMessaging() => UnreadMessaging = 0;
}

