using System;

namespace client_win.Modules.Notifications.Models;

public sealed class NotificationItem
{
    public string Id { get; init; } = string.Empty;
    public string Kind { get; init; } = string.Empty;
    public DateTimeOffset CreatedAt { get; init; }
    public bool IsRead { get; init; }

    // Admin contact
    public string? ContactId { get; init; }
    public int FromUserId { get; init; }
    public string FromUsername { get; init; } = string.Empty;
    public int? ToUserId { get; init; }
    public string Message { get; init; } = string.Empty;
}
