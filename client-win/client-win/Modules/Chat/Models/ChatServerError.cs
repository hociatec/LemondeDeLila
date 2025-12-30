using System;

namespace client_win.Modules.Chat.Models;

public sealed class ChatServerError
{
    public ChatServerError(string message, string? reason = null, DateTime? until = null)
    {
        Message = message ?? string.Empty;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason;
        Until = until;
    }

    public string Message { get; }
    public string? Reason { get; }
    public DateTime? Until { get; }
}

