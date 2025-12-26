using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Dtos;
using client_win.Modules.Network.WebSockets;
using Serilog;

namespace client_win.Modules.Game.Play.Services;

public sealed class GameSession : IAsyncDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly IWebSocketConnection _socket;

    public GameSession(int roomId, string gameType, IWebSocketConnection socket)
    {
        if (roomId <= 0) throw new ArgumentOutOfRangeException(nameof(roomId));
        RoomId = roomId;
        GameType = gameType ?? string.Empty;
        _socket = socket ?? throw new ArgumentNullException(nameof(socket));
        _socket.MessageReceived += OnRawMessage;
        _socket.Error += _ => { };
    }

    public int RoomId { get; }
    public string GameType { get; }

    public GameStateDto? LastState { get; private set; }

    public event Action<GameStateDto>? StateUpdated;
    public event Action<string>? RawMessageReceived;
    public event Action<string>? ErrorReceived;

    public Task CloseAsync() => _socket.CloseAsync();

    public async Task JoinAsync(CancellationToken cancellationToken = default)
    {
        var join = JsonSerializer.Serialize(
            new { type = "game.join", payload = new { roomId = RoomId, gameType = GameType } },
            _json);
        await _socket.SendAsync(join, cancellationToken).ConfigureAwait(false);
    }

    public async Task RequestStateAsync(CancellationToken cancellationToken = default)
    {
        var msg = JsonSerializer.Serialize(
            new { type = "game.state", payload = new { roomId = RoomId, gameType = GameType } },
            _json);
        await _socket.SendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

    public async Task SendActionsAsync(IReadOnlyList<GameClientAction> actions, CancellationToken cancellationToken = default)
    {
        actions ??= Array.Empty<GameClientAction>();
        var msg = JsonSerializer.Serialize(
            new
            {
                type = "game.actions",
                payload = new
                {
                    roomId = RoomId,
                    gameType = GameType,
                    actions
                }
            },
            _json);
        await _socket.SendAsync(msg, cancellationToken).ConfigureAwait(false);
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
        ParseState(raw);
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

    private void ParseState(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString() ?? string.Empty;
            if (!string.Equals(type, "game.state", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind == JsonValueKind.Undefined ||
                payloadProp.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = payloadProp.Deserialize<GameStateDto>(_json);
            if (payload == null) return;

            LastState = payload;
            StateUpdated?.Invoke(payload);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "GameSession: ignore message parse error");
        }
    }
}
