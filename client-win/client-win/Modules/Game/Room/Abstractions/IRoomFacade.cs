using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Network.WebSockets;

namespace client_win.Modules.Game.Room.Services;

public interface IRoomFacade : IAsyncDisposable
{
    RoomPayloadDto? CurrentPayload { get; }
    bool IsSpectator { get; }

    event Action<RoomPayloadDto>? RoomUpdated;
    event Action<string>? ErrorReceived;
    event Action<string>? Left;
    event Action<WebSocketState>? ConnectionStateChanged;
    event Action<RoomAnnouncement>? AnnouncementReceived;
    event Action<string>? InfoReceived;
    event Action<string>? BotJoined;
    event Action<string>? BotRemoved;
    event Action<bool>? PrivacyChanged;
    event Action<bool>? RoleChanged;
    event Action<RoomChatMessageDto>? ChatMessageReceived;
    event Action<IReadOnlyList<RoomChatMessageDto>>? ChatHistoryReceived;
    event Action<JsonElement>? IntentReceived;

    Task AddBotAsync(CancellationToken cancellationToken = default);
    Task RemoveBotAsync(CancellationToken cancellationToken = default);
    Task TogglePrivacyAsync(CancellationToken cancellationToken = default);
    Task ToggleRoleAsync(CancellationToken cancellationToken = default);
    Task RequestInfoAsync(CancellationToken cancellationToken = default);
    Task RequestChatHistoryAsync(CancellationToken cancellationToken = default);
    Task SendChatMessageAsync(string message, CancellationToken cancellationToken = default);
    Task RequestStateRefreshAsync(bool force = false);
    Task LeaveAsync(CancellationToken cancellationToken = default);
}
