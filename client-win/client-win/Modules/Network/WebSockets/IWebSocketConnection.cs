using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Network.WebSockets;

public interface IWebSocketConnection : IAsyncDisposable
{
    event Action<WebSocketState>? StateChanged;
    event Action<string>? MessageReceived;
    event Action<string>? Error;

    Task ConnectAsync(Uri endpoint, string? token = null, IDictionary<string, string>? headers = null, CancellationToken cancellationToken = default);
    Task SendAsync(string message, CancellationToken cancellationToken = default);
    Task CloseAsync();
}
