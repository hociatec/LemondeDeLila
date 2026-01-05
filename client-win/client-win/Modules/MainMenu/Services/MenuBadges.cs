using client_win.Core;
using System;
using System.Collections.Generic;

namespace client_win.Modules.MainMenu.Services;

public sealed class MenuBadges : ObservableObject, IMenuBadges
{
    private int _unreadNotifications;
    private int _unreadMessaging;
    private readonly HashSet<string> _unreadNotificationIds = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _unreadMessageIds = new(StringComparer.OrdinalIgnoreCase);

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

    public void AddUnreadNotification(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return;
        }
        if (_unreadNotificationIds.Add(id))
        {
            UnreadNotifications = _unreadNotificationIds.Count;
        }
    }

    public void MarkNotificationRead(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return;
        }
        if (_unreadNotificationIds.Remove(id))
        {
            UnreadNotifications = _unreadNotificationIds.Count;
        }
    }

    public void AddUnreadMessage(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return;
        }
        if (_unreadMessageIds.Add(id))
        {
            UnreadMessaging = _unreadMessageIds.Count;
        }
    }

    public void MarkMessageRead(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return;
        }
        if (_unreadMessageIds.Remove(id))
        {
            UnreadMessaging = _unreadMessageIds.Count;
        }
    }
}
