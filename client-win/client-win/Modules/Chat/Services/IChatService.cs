using System;
using System.Collections.ObjectModel;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Chat.Models;

namespace client_win.Modules.Chat.Services;

public interface IChatService : IAsyncDisposable
{
    ObservableCollection<ChatMessage> Messages { get; }
    ChatState State { get; }
    string StatusMessage { get; }
    int EditWindowSeconds { get; }
    ChatServerError? LastServerError { get; }
    event Action<string>? StatusChanged;
    event Action<string>? Error;
    event Action<ChatMessage>? MessageArrived;

    Task<bool> OpenAsync(CancellationToken cancellationToken = default);
    Task SendAsync(string text, CancellationToken cancellationToken = default);
    Task EditAsync(string messageId, string text, CancellationToken cancellationToken = default);
    Task DeleteAsync(string messageId, CancellationToken cancellationToken = default);
    Task CloseAsync();
}
