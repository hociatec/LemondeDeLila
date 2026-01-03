using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomChatCommands : IDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly RoomSession _session;

    public RoomChatCommands(RoomSession session)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _session.RawMessageReceived += OnRawMessageReceived;
    }

    public event Action<RoomChatMessageDto>? MessageReceived;
    public event Action<IReadOnlyList<RoomChatMessageDto>>? HistoryReceived;

    public Task RequestHistoryAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAsync("room.chat.history", payload: null, cancellationToken: cancellationToken);

    public void Dispose()
    {
        _session.RawMessageReceived -= OnRawMessageReceived;
    }

    private void OnRawMessageReceived(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString() ?? string.Empty;

            if (string.Equals(type, "room.chat.message", StringComparison.OrdinalIgnoreCase))
            {
                if (!root.TryGetProperty("payload", out var payloadProp) ||
                    payloadProp.ValueKind == JsonValueKind.Undefined ||
                    payloadProp.ValueKind == JsonValueKind.Null)
                {
                    return;
                }

                var payload = payloadProp.Deserialize<RoomChatMessageDto>(_json);
                if (payload == null || string.IsNullOrWhiteSpace(payload.Message)) return;
                MessageReceived?.Invoke(payload);
                return;
            }

            if (string.Equals(type, "room.chat.history", StringComparison.OrdinalIgnoreCase))
            {
                if (!root.TryGetProperty("payload", out var payloadProp) ||
                    payloadProp.ValueKind != JsonValueKind.Object)
                {
                    return;
                }

                if (!payloadProp.TryGetProperty("messages", out var messagesProp) ||
                    messagesProp.ValueKind != JsonValueKind.Array)
                {
                    return;
                }

                var messages = new List<RoomChatMessageDto>();
                foreach (var item in messagesProp.EnumerateArray())
                {
                    var msg = item.Deserialize<RoomChatMessageDto>(_json);
                    if (msg == null || string.IsNullOrWhiteSpace(msg.Message)) continue;
                    messages.Add(msg);
                }

                if (messages.Count > 0)
                {
                    HistoryReceived?.Invoke(messages);
                }
            }
        }
        catch
        {
            // Ignore parse errors (best effort).
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

