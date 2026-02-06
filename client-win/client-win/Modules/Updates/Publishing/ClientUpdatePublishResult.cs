namespace client_win.Modules.Updates;

public sealed record ClientUpdatePublishResult(
    bool Success,
    string StatusMessage,
    string? PublishedVersion = null);

