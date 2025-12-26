using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Network.WebSockets;
using Serilog;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomSession : IAsyncDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly IWebSocketConnection _socket;

    public RoomSession(int roomId, string gameType, IWebSocketConnection socket)
    {
        RoomId = roomId;
        GameType = gameType ?? string.Empty;
        _socket = socket ?? throw new ArgumentNullException(nameof(socket));
        _socket.MessageReceived += OnMessage;
        _socket.Error += _ => { };
    }

    public int RoomId { get; }
    public string GameType { get; }

    public RoomPayloadDto? LastRoomState { get; internal set; }

    public event Action<RoomPayloadDto>? RoomUpdated;

    public Task CloseAsync() => _socket.CloseAsync();

    public async ValueTask DisposeAsync()
    {
        _socket.MessageReceived -= OnMessage;
        await _socket.DisposeAsync().ConfigureAwait(false);
    }

    private void OnMessage(string raw)
    {
        try
        {
            var envelope = JsonSerializer.Deserialize<RoomEnvelope<JsonElement>>(raw, _json);
            if (envelope == null) return;

            if (!string.Equals(envelope.Type, "room.updated", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(envelope.Type, "room.created", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (envelope.Payload.ValueKind == JsonValueKind.Undefined || envelope.Payload.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = envelope.Payload.Deserialize<RoomPayloadDto>(_json);
            if (payload == null) return;

            LastRoomState = payload;
            RoomUpdated?.Invoke(payload);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "RoomSession: ignore message parse error");
        }
    }
}
