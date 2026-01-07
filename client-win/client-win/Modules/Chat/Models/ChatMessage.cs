using System;

namespace client_win.Modules.Chat.Models;

public sealed class ChatMessage
{
    public ChatMessage(
        string user,
        string text,
        DateTime timestamp,
        string? id = null,
        int? userId = null,
        bool isDeleted = false,
        bool isMine = false)
    {
        User = user;
        Text = text;
        Timestamp = timestamp;
        Id = id;
        UserId = userId;
        IsDeleted = isDeleted;
        IsMine = isMine;
    }

    public string? Id { get; }
    public int? UserId { get; }
    public string User { get; }
    public string Text { get; }
    public DateTime Timestamp { get; }
    public bool IsDeleted { get; }
    public bool IsMine { get; }
}
