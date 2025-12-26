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
        _socket.MessageReceived += OnRawMessage;
        _socket.Error += _ => { };
    }

    public int RoomId { get; }
    public string GameType { get; }

    public RoomPayloadDto? LastRoomState { get; internal set; }

    public event Action<RoomPayloadDto>? RoomUpdated;
    public event Action<string>? RawMessageReceived;
    public event Action<string>? ErrorReceived;

    public Task CloseAsync() => _socket.CloseAsync();

    public async Task SendCommandAsync(string type, object? payload = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(type)) throw new ArgumentException("type requis", nameof(type));
        var msg = JsonSerializer.Serialize(new { type, payload = payload ?? new { } }, _json);
        await _socket.SendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

    public async Task LeaveAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var leave = JsonSerializer.Serialize(new { type = "room.leave", payload = new { } }, _json);
            await _socket.SendAsync(leave, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            // Best-effort (si l'envoi échoue, on ferme quand même).
        }

        await _socket.CloseAsync().ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        _socket.MessageReceived -= OnRawMessage;
        await _socket.DisposeAsync().ConfigureAwait(false);
    }

    private void OnRawMessage(string raw)
    {
        RawMessageReceived?.Invoke(raw);
        ParseError(raw);
        ParseRoomState(raw);
    }

    private void ParseError(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString() ?? string.Empty;
            if (!string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("message", out var messageProp))
            {
                return;
            }

            var message = messageProp.GetString();
            if (string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            ErrorReceived?.Invoke(message.Trim());
        }
        catch
        {
            // ignore
        }
    }

    private void ParseRoomState(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString() ?? string.Empty;

            if (!string.Equals(type, "room.updated", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(type, "room.created", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind == JsonValueKind.Undefined ||
                payloadProp.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = payloadProp.Deserialize<RoomPayloadDto>(_json);
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
