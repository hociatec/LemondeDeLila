using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Session.Dtos;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using Serilog;

namespace client_win.Modules.Game.Play.Session.Services;

public sealed class GameSession : IAsyncDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly IWebSocketConnection _socket;
    private readonly GameSessionMessageRouter _router;
    private readonly GameSessionKeepAlive _keepAlive;
    private readonly CancellationTokenSource _lifetimeCts = new();
    private Task? _watchdogLoop;
    private DateTime _lastPongUtc = DateTime.MinValue;
    private readonly object _actionDedupeLock = new();
    private string? _lastActionKey;
    private DateTime _lastActionAtUtc;
    private static readonly TimeSpan ActionDedupeWindow = TimeSpan.FromMilliseconds(250);

    // NOTE: GameSession est créé après ConnectAsync côté GameGatewayClient (souvent socket déjà connecté).
    // L'état initial est lu depuis IWebSocketConnection.State.
    private WebSocketState _state = WebSocketState.Disconnected;
    private bool _everConnected;

    public GameSession(int roomId, string gameType, IWebSocketConnection socket)
    {
        if (roomId <= 0) throw new ArgumentOutOfRangeException(nameof(roomId));
        RoomId = roomId;
        GameType = gameType ?? string.Empty;
        _socket = socket ?? throw new ArgumentNullException(nameof(socket));
        _socket.StateChanged += OnSocketStateChanged;

        _state = _socket.State;
        _everConnected = _state == WebSocketState.Connected;

        _router = new GameSessionMessageRouter(
            _json,
            emitState: s =>
            {
                LastState = s;
                StateUpdated?.Invoke(s);
            },
            emitTurn: t =>
            {
                LastTurnInfo = t;
                TurnUpdated?.Invoke(t);
            },
            emitRules: r =>
            {
                LastRules = r;
                RulesReceived?.Invoke(r);
            },
            emitError: msg => ErrorReceived?.Invoke(msg),
            emitCommandAck: msg => CommandAckReceived?.Invoke(msg),
            emitUiMessage: msg => UiMessageReceived?.Invoke(msg),
            emitStatePatch: raw =>
            {
                if (TryApplyStatePatch(raw, out var patched) && patched != null)
                {
                    LastState = patched;
                    StateUpdated?.Invoke(patched);
                    return;
                }

                _ = Task.Run(async () =>
                {
                    try { await RequestStateAsync().ConfigureAwait(false); } catch { }
                });
            },
            emitEnded: ended => EndedReceived?.Invoke(ended),
            emitRaw: msg => RawMessageReceived?.Invoke(msg),
            emitPong: () => _lastPongUtc = DateTime.UtcNow);
        _socket.MessageReceived += _router.HandleRawMessage;
        _socket.Error += OnSocketError;

        _keepAlive = new GameSessionKeepAlive(
            isConnected: () => IsConnected,
            sendPing: SendPingAsync);
        _keepAlive.Start();

        _lastPongUtc = DateTime.UtcNow;
        _watchdogLoop = Task.Run(() => WatchdogLoopAsync(_lifetimeCts.Token));
    }

    public int RoomId { get; }
    public string GameType { get; }

    public GameStateDto? LastState { get; private set; }
    public TurnInfoDto? LastTurnInfo { get; private set; }
    public GameRulesPayloadDto? LastRules { get; private set; }

    public bool IsConnected => _state == WebSocketState.Connected;

    public event Action<GameStateDto>? StateUpdated;
    public event Action<TurnInfoDto>? TurnUpdated;
    public event Action<GameRulesPayloadDto>? RulesReceived;
    public event Action<string>? RawMessageReceived;
    public event Action<string>? ErrorReceived;
    public event Action<string>? CommandAckReceived;
    public event Action<string>? UiMessageReceived;
    public event Action<GameEndedDto>? EndedReceived;

    public Task CloseAsync() => _socket.CloseAsync();

    public void StartKeepAlive(TimeSpan? interval = null) => _keepAlive.Start(interval);

    public void StopKeepAlive() => _keepAlive.Stop();

    public async Task JoinAsync(CancellationToken cancellationToken = default)
    {
        if (!IsConnected)
        {
            ErrorReceived?.Invoke("Connexion jeu perdue.");
            return;
        }

        var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
        var join = JsonSerializer.Serialize(
            new { type = "game.join", payload = new { roomId = RoomId, gameType = GameType, _trace = trace } },
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

        var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
        var msg = JsonSerializer.Serialize(
            new { type = "game.state", payload = new { roomId = RoomId, gameType = GameType, _trace = trace } },
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

        var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
        var msg = JsonSerializer.Serialize(
            new { type = "game.turn", payload = new { roomId = RoomId, gameType = GameType, _trace = trace } },
            _json);
        await TrySendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

    public async Task RequestRulesAsync(CancellationToken cancellationToken = default)
    {
        if (!IsConnected)
        {
            ErrorReceived?.Invoke("Connexion jeu perdue.");
            return;
        }

        var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
        var msg = JsonSerializer.Serialize(
            new { type = "game.rules", payload = new { gameType = GameType, _trace = trace } },
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

        if (IsDuplicateAction(actions))
        {
            return;
        }

        var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
        actions ??= Array.Empty<GameClientAction>();
        var msg = JsonSerializer.Serialize(
            new
            {
                type = "game.actions",
                payload = new
                {
                    roomId = RoomId,
                    gameType = GameType,
                    actions,
                    _trace = trace
                }
            },
            _json);
        await TrySendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

    private bool IsDuplicateAction(IReadOnlyList<GameClientAction> actions)
    {
        try
        {
            var key = BuildActionKey(actions);
            if (string.IsNullOrWhiteSpace(key))
            {
                return false;
            }

            var now = DateTime.UtcNow;
            lock (_actionDedupeLock)
            {
                if (_lastActionKey != null &&
                    string.Equals(_lastActionKey, key, StringComparison.Ordinal) &&
                    now - _lastActionAtUtc < ActionDedupeWindow)
                {
                    return true;
                }

                _lastActionKey = key;
                _lastActionAtUtc = now;
            }
        }
        catch
        {
            // best-effort: ne pas bloquer l'envoi si la déduplication échoue.
        }

        return false;
    }

    private static string BuildActionKey(IReadOnlyList<GameClientAction> actions)
    {
        if (actions == null || actions.Count == 0)
        {
            return string.Empty;
        }

        try
        {
            var normalized = actions
                .Select(a => new
                {
                    type = (a?.Type ?? string.Empty).Trim(),
                    payload = a?.Payload,
                    meta = a?.Meta
                })
                .ToList();
            return JsonSerializer.Serialize(normalized, _json);
        }
        catch
        {
            // Fallback: clé basée uniquement sur les types d'action.
            return string.Join("|", actions.Select(a => (a?.Type ?? string.Empty).Trim()));
        }
    }

    public async Task SendKeyAsync(string key, CancellationToken cancellationToken = default)
    {
        if (!IsConnected)
        {
            ErrorReceived?.Invoke("Connexion jeu perdue.");
            return;
        }

        var normalized = (key ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return;
        }

        var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
        var msg = JsonSerializer.Serialize(
            new { type = "game.key", payload = new { roomId = RoomId, gameType = GameType, key = normalized, _trace = trace } },
            _json);
        await TrySendAsync(msg, cancellationToken).ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        StopKeepAlive();
        await _keepAlive.DisposeAsync().ConfigureAwait(false);

        try { _lifetimeCts.Cancel(); } catch { }
        if (_watchdogLoop != null)
        {
            try { await _watchdogLoop.ConfigureAwait(false); } catch { }
            _watchdogLoop = null;
        }

        _socket.StateChanged -= OnSocketStateChanged;
        _socket.MessageReceived -= _router.HandleRawMessage;
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

    private bool TryApplyStatePatch(string rawPatchPayload, out GameStateDto? patchedState)
    {
        patchedState = null;
        var current = LastState;
        if (current == null)
        {
            return false;
        }

        try
        {
            using var patchDoc = JsonDocument.Parse(rawPatchPayload ?? "{}");
            var patchRoot = patchDoc.RootElement;
            if (patchRoot.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (patchRoot.TryGetProperty("baseTurnIndex", out var baseTurnProp) &&
                baseTurnProp.ValueKind == JsonValueKind.Number &&
                baseTurnProp.TryGetInt32(out var baseTurnIndex))
            {
                if (current.TurnIndex != baseTurnIndex)
                {
                    return false;
                }
            }

            var currentNode = JsonSerializer.SerializeToNode(current, _json) as JsonObject;
            if (currentNode == null)
            {
                return false;
            }

            if (patchRoot.TryGetProperty("unset", out var unsetProp) &&
                unsetProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var keyNode in unsetProp.EnumerateArray())
                {
                    if (keyNode.ValueKind != JsonValueKind.String)
                    {
                        continue;
                    }

                    var key = (keyNode.GetString() ?? string.Empty).Trim();
                    if (key.Length == 0)
                    {
                        continue;
                    }

                    currentNode.Remove(key);
                }
            }

            if (patchRoot.TryGetProperty("set", out var setProp) &&
                setProp.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in setProp.EnumerateObject())
                {
                    var key = (property.Name ?? string.Empty).Trim();
                    if (key.Length == 0)
                    {
                        continue;
                    }

                    currentNode[key] = JsonNode.Parse(property.Value.GetRawText());
                }
            }

            patchedState = currentNode.Deserialize<GameStateDto>(_json);
            return patchedState != null;
        }
        catch
        {
            return false;
        }
    }

    private Task SendPingAsync(CancellationToken cancellationToken)
    {
        var ping = JsonSerializer.Serialize(
            new { type = "game.ping", payload = new { clientSentAtMs = ServerClock.UtcNowMs() } },
            _json);
        return TrySendAsync(ping, cancellationToken);
    }

    private async Task WatchdogLoopAsync(CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var ok = await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false);
                if (!ok) return;
            }
            catch
            {
                return;
            }

            if (!IsConnected)
            {
                continue;
            }

            if (_lastPongUtc == DateTime.MinValue)
            {
                continue;
            }

            var age = DateTime.UtcNow - _lastPongUtc;
            if (age <= TimeSpan.FromSeconds(60))
            {
                continue;
            }

            // Connexion "fantôme" probable: forcer une reconnexion via le contrôleur (en fermant le WS).
            try { ErrorReceived?.Invoke("Connexion jeu perdue."); } catch { }
            _ = Task.Run(async () =>
            {
                try { await _socket.CloseAsync().ConfigureAwait(false); } catch { }
            });
        }
    }
}
