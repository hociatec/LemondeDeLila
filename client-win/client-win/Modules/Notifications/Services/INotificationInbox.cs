using System.Collections.ObjectModel;
using System.Collections.Generic;
using client_win.Modules.Notifications.Models;

namespace client_win.Modules.Notifications.Services;

public interface INotificationInbox
{
    ObservableCollection<NotificationItem> Items { get; }
    void ReplaceAll(IEnumerable<NotificationItem> items);
    void Upsert(NotificationItem item);
    void Remove(string id);
}
