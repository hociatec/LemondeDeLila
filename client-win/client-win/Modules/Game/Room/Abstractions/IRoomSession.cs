using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Network.WebSockets;

namespace client_win.Modules.Game.Room.Services;

public interface IRoomSession : IAsyncDisposable
{
    int RoomId { get; }
    RoomPayloadDto? LastRoomState { get; }
    WebSocketState State { get; }
    event Action<RoomPayloadDto>? RoomUpdated;
    event Action<string>? ErrorReceived;
    event Action<string>? Left;
    event Action<WebSocketState>? ConnectionStateChanged;
    event Action<string>? RawMessageReceived;

    Task RequestStateRefreshAsync(bool force = false);
    Task SendCommandAsync(string type, object? payload = null, CancellationToken cancellationToken = default);
    Task<bool> SendCommandAwaitAckAsync(
        string type,
        object? payload = null,
        TimeSpan? ackTimeout = null,
        CancellationToken cancellationToken = default);
    Task LeaveAsync(CancellationToken cancellationToken = default);
}
