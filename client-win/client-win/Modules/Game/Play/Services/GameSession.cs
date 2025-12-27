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
    // NOTE: GameSession est créé après ConnectAsync côté GameGatewayClient, donc le socket est déjà connecté.
    // IWebSocketConnection ne fournit pas l'état courant; on démarre donc en "Connected" et on se met à jour
    // via l'événement StateChanged pour les transitions ultérieures.
    private WebSocketState _state = WebSocketState.Connected;
    private bool _everConnected = true;

    public GameSession(int roomId, string gameType, IWebSocketConnection socket)
    {
        if (roomId <= 0) throw new ArgumentOutOfRangeException(nameof(roomId));
        RoomId = roomId;
        GameType = gameType ?? string.Empty;
        _socket = socket ?? throw new ArgumentNullException(nameof(socket));
        _socket.StateChanged += OnSocketStateChanged;
        _socket.MessageReceived += OnRawMessage;
        _socket.Error += OnSocketError;
    }

    public int RoomId { get; }
    public string GameType { get; }

    public GameStateDto? LastState { get; private set; }
    public TurnInfoDto? LastTurnInfo { get; private set; }

    public bool IsConnected => _state == WebSocketState.Connected;

    public event Action<GameStateDto>? StateUpdated;
    public event Action<TurnInfoDto>? TurnUpdated;
    public event Action<string>? RawMessageReceived;
    public event Action<string>? ErrorReceived;

    public Task CloseAsync() => _socket.CloseAsync();

    public async Task JoinAsync(CancellationToken cancellationToken = default)
    {
        if (!IsConnected)
        {
            ErrorReceived?.Invoke("Connexion jeu perdue.");
            return;
        }

        var join = JsonSerializer.Serialize(
            new { type = "game.join", payload = new { roomId = RoomId, gameType = GameType } },
            _json);
        await TrySendAsync(join, cancellationToken).ConfigureAwait(false);
    }

    public async Task RequestStateAsync(CancellationToken cancellationToken = default)
    {
        if (!IsConnected)
        {
            ErrorReceived?.Invoke("Connexion jeu perdue.");
            return;
        }

        var msg = JsonSerializer.Serialize(
            new { type = "game.state", payload = new { roomId = RoomId, gameType = GameType } },
            _json);
        await TrySendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

    public async Task RequestTurnAsync(CancellationToken cancellationToken = default)
    {
        if (!IsConnected)
        {
            ErrorReceived?.Invoke("Connexion jeu perdue.");
            return;
        }

        var msg = JsonSerializer.Serialize(
            new { type = "game.turn", payload = new { roomId = RoomId, gameType = GameType } },
            _json);
        await TrySendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

    public async Task SendActionsAsync(IReadOnlyList<GameClientAction> actions, CancellationToken cancellationToken = default)
    {
        if (!IsConnected)
        {
            ErrorReceived?.Invoke("Connexion jeu perdue.");
            return;
        }

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
        await TrySendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        _socket.StateChanged -= OnSocketStateChanged;
        _socket.MessageReceived -= OnRawMessage;
        _socket.Error -= OnSocketError;
        await _socket.DisposeAsync().ConfigureAwait(false);
    }

    private void OnSocketStateChanged(WebSocketState state)
    {
        var previous = _state;
        _state = state;

        if (state == WebSocketState.Connected)
        {
            _everConnected = true;
            return;
        }

        if (_everConnected &&
            previous == WebSocketState.Connected &&
            state is WebSocketState.Disconnected or WebSocketState.Error)
        {
            ErrorReceived?.Invoke("Connexion jeu perdue.");
        }
    }

    private void OnSocketError(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }
        ErrorReceived?.Invoke(message.Trim());
    }

    private void OnRawMessage(string raw)
    {
        RawMessageReceived?.Invoke(raw);
        ParseError(raw);
        ParseState(raw);
        ParseTurn(raw);
    }

    private async Task TrySendAsync(string message, CancellationToken cancellationToken)
    {
        try
        {
            await _socket.SendAsync(message, cancellationToken).ConfigureAwait(false);
        }
        catch (InvalidOperationException ex)
        {
            Log.Debug(ex, "GameSession: send ignored (socket not connected)");
            ErrorReceived?.Invoke("Connexion jeu perdue.");
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "GameSession: send ignored");
            ErrorReceived?.Invoke(ex.Message);
        }
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

    private void ParseTurn(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString() ?? string.Empty;
            if (!string.Equals(type, "game.turn", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind == JsonValueKind.Undefined ||
                payloadProp.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = payloadProp.Deserialize<TurnInfoDto>(_json);
            if (payload == null) return;

            LastTurnInfo = payload;
            TurnUpdated?.Invoke(payload);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "GameSession: ignore turn parse error");
        }
    }
}
