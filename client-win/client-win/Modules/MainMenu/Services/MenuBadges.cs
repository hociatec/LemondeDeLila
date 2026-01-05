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

    public void SetUnreadNotifications(int count) => UnreadNotifications = Math.Max(0, count);

    public void SetUnreadMessaging(int count) => UnreadMessaging = Math.Max(0, count);
}
