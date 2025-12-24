using System;

namespace client_win.Modules.Messaging.Models;

public sealed class MessagingMessage
{
    public string Id { get; init; } = string.Empty;
    public MessagingUser Sender { get; init; } = new();
    public MessagingUser Recipient { get; init; } = new();
    public string Subject { get; init; } = string.Empty;
    public string Text { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public bool IsSent { get; init; }
    public bool IsDeleted { get; init; }

    public override string ToString()
    {
        return $"De: {Sender.Username} - Sujet: {Subject} - {Text}";
    }
}
