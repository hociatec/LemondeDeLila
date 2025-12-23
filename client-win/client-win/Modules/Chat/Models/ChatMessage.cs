using System;

namespace client_win.Modules.Chat.Models;

public sealed class ChatMessage
{
    public ChatMessage(string user, string text, DateTime timestamp)
    {
        User = user;
        Text = text;
        Timestamp = timestamp;
    }

    public string User { get; }
    public string Text { get; }
    public DateTime Timestamp { get; }
}
