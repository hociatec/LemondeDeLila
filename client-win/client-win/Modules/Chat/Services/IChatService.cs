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
    event Action<string>? StatusChanged;
    event Action<string>? Error;

    Task<bool> OpenAsync(CancellationToken cancellationToken = default);
    Task SendAsync(string text, CancellationToken cancellationToken = default);
    Task CloseAsync();
}
