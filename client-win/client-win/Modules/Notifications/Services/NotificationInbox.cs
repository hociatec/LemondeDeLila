using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using client_win.Modules.Notifications.Models;

namespace client_win.Modules.Notifications.Services;

public sealed class NotificationInbox : INotificationInbox
{
    public ObservableCollection<NotificationItem> Items { get; } = new();

    public void ReplaceAll(IEnumerable<NotificationItem> items)
    {
        Items.Clear();
        foreach (var it in (items ?? Array.Empty<NotificationItem>())
                     .Select(Clone)
                     .OrderByDescending(x => x.CreatedAt))
        {
            Items.Add(it);
        }
    }

    public void Upsert(NotificationItem item)
    {
        if (item == null || string.IsNullOrWhiteSpace(item.Id))
        {
            return;
        }

        var existing = Items.FirstOrDefault(x => string.Equals(x.Id, item.Id, StringComparison.Ordinal));
        if (existing != null)
        {
            var idx = Items.IndexOf(existing);
            if (idx >= 0)
            {
                Items[idx] = Clone(item);
            }
            return;
        }

        // Keep newest first.
        var insertAt = 0;
        while (insertAt < Items.Count && Items[insertAt].CreatedAt > item.CreatedAt)
        {
            insertAt++;
        }
        Items.Insert(insertAt, Clone(item));
    }

    public void Remove(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return;
        }
        var existing = Items.FirstOrDefault(x => string.Equals(x.Id, id, StringComparison.Ordinal));
        if (existing != null)
        {
            Items.Remove(existing);
        }
    }

    private static NotificationItem Clone(NotificationItem item)
    {
        return new NotificationItem
        {
            Id = item.Id ?? string.Empty,
            Kind = item.Kind ?? string.Empty,
            CreatedAt = item.CreatedAt,
            ContactId = item.ContactId,
            FromUserId = item.FromUserId,
            FromUsername = item.FromUsername ?? string.Empty,
            ToUserId = item.ToUserId,
            Message = item.Message ?? string.Empty,
            AdminStatus = item.AdminStatus,
            IsHandled = item.IsHandled,
            HandledAt = item.HandledAt,
            HandledByUsername = item.HandledByUsername,
        };
    }
}
