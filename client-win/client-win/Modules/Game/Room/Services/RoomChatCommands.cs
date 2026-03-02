using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomChatCommands : IDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly RoomSession _session;
    private readonly IDisposable _messageSubscription;
    private readonly IDisposable _historySubscription;

    public RoomChatCommands(RoomSession session, RoomMessageRouter router)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        if (router == null) throw new ArgumentNullException(nameof(router));
        _messageSubscription = router.Subscribe("room.chat.message", ctx => HandleMessage(ctx.Payload));
        _historySubscription = router.Subscribe("room.chat.history", ctx => HandleHistory(ctx.Payload));
    }

    public event Action<RoomChatMessageDto>? MessageReceived;
    public event Action<IReadOnlyList<RoomChatMessageDto>>? HistoryReceived;

    public Task RequestHistoryAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAsync("room.chat.history", payload: null, cancellationToken: cancellationToken);

    public void Dispose()
    {
        _messageSubscription.Dispose();
        _historySubscription.Dispose();
    }

    private void HandleMessage(JsonElement payload)
    {
        if (payload.ValueKind == JsonValueKind.Undefined || payload.ValueKind == JsonValueKind.Null)
        {
            return;
        }

        var message = payload.Deserialize<RoomChatMessageDto>(_json);
        if (message == null || string.IsNullOrWhiteSpace(message.Message))
        {
            return;
        }

        MessageReceived?.Invoke(message);
    }

    private void HandleHistory(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        if (!payload.TryGetProperty("messages", out var messagesProp) ||
            messagesProp.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        var messages = new List<RoomChatMessageDto>();
        foreach (var item in messagesProp.EnumerateArray())
        {
            var msg = item.Deserialize<RoomChatMessageDto>(_json);
            if (msg == null || string.IsNullOrWhiteSpace(msg.Message))
            {
                continue;
            }
            messages.Add(msg);
        }

        if (messages.Count > 0)
        {
            HistoryReceived?.Invoke(messages);
        }
    }
}

public sealed class RoomChatMessageDto
{
    public long Seq { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

