using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Error;
using client_win.Modules.Game.Models;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.User.Services;

namespace client_win.Modules.Game.Sessions;

public sealed class RoomSession : IAsyncDisposable
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly IWebSocketConnection _connection;
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly ErrorBus? _errors;
    private readonly SemaphoreSlim _mutex = new(1, 1);

    private RoomSnapshot _snapshot = new();
    private bool _connected;

    public RoomSession(IWebSocketConnection connection, ClientConfiguration config, ISessionService session, ErrorBus? errors = null)
    {
        _connection = connection ?? throw new ArgumentNullException(nameof(connection));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _errors = errors;
        _connection.MessageReceived += HandleMessage;
        _connection.Error += HandleError;
        _connection.StateChanged += HandleStateChanged;
    }

    public event Action<RoomSnapshot>? RoomUpdated;
    public event Action<string>? HistoryEvent;
    public event Action<string>? ErrorEvent;

    public RoomSnapshot Snapshot => _snapshot;

    public async Task ConnectAsync(int roomId, bool spectator, CancellationToken cancellationToken = default)
    {
        await _mutex.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (roomId <= 0)
            {
                throw new InvalidOperationException("roomId invalide");
            }

            var token = _session.CurrentUser?.Token;
            if (string.IsNullOrWhiteSpace(token))
            {
                throw new InvalidOperationException("Authentification requise");
            }

            var headers = new Dictionary<string, string>();
            if (!string.IsNullOrWhiteSpace(_config.SharedSecret))
            {
                headers["x-lila-ws-signature"] = _config.SharedSecret!;
            }

            var builder = new UriBuilder(_config.RealtimeGatewayWs);
            builder.Query = spectator
                ? $"room={roomId}&spectator=1"
                : $"room={roomId}";

            _snapshot = new RoomSnapshot
            {
                RoomId = roomId,
                IsSpectator = spectator
            };

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(10));
            await _connection.ConnectAsync(builder.Uri, token, headers, timeoutCts.Token).ConfigureAwait(false);
            _connected = true;
            HistoryEvent?.Invoke("Connexion a la table etablie.");
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task SendCommandAsync(string type, object payload, CancellationToken cancellationToken = default)
    {
        if (!_connected)
        {
            throw new InvalidOperationException("Connexion room inactive");
        }
        var message = JsonSerializer.Serialize(new { type, payload }, SerializerOptions);
        await _connection.SendAsync(message, cancellationToken).ConfigureAwait(false);
    }

    public async Task CloseAsync()
    {
        await _mutex.WaitAsync().ConfigureAwait(false);
        try
        {
            if (_connected)
            {
                _connected = false;
                await _connection.CloseAsync().ConfigureAwait(false);
                HistoryEvent?.Invoke("Connexion a la table fermee.");
            }
        }
        finally
        {
            _mutex.Release();
        }
    }

    private void HandleMessage(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            string type = root.TryGetProperty("type", out var typeNode) ? typeNode.GetString() ?? string.Empty : string.Empty;
            if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
            {
                string message = ExtractErrorMessage(root);
                ErrorEvent?.Invoke(message);
                HistoryEvent?.Invoke($"Erreur: {message}");
                return;
            }

            if (string.Equals(type, "room.updated", StringComparison.OrdinalIgnoreCase))
            {
                ApplyRoomUpdated(root);
                return;
            }

            if (string.Equals(type, "room.privacy", StringComparison.OrdinalIgnoreCase))
            {
                ApplyPrivacyUpdated(root);
                return;
            }

            if (string.Equals(type, "room.role", StringComparison.OrdinalIgnoreCase))
            {
                ApplyRoleUpdated(root);
                return;
            }

            if (string.Equals(type, "bot.added", StringComparison.OrdinalIgnoreCase))
            {
                HistoryEvent?.Invoke("Bot ajoute.");
                return;
            }

            if (string.Equals(type, "bot.removed", StringComparison.OrdinalIgnoreCase))
            {
                HistoryEvent?.Invoke("Bot retire.");
                return;
            }

            if (string.Equals(type, "state-updated", StringComparison.OrdinalIgnoreCase))
            {
                HistoryEvent?.Invoke("Etat de jeu mis a jour.");
                return;
            }
        }
        catch (Exception ex)
        {
            ErrorEvent?.Invoke($"Erreur parsing WS: {ex.Message}");
        }
    }

    private void ApplyRoomUpdated(JsonElement root)
    {
        if (!root.TryGetProperty("payload", out var payload))
        {
            return;
        }

        if (!payload.TryGetProperty("room", out var room))
        {
            return;
        }

        var updated = BuildSnapshotFromRoom(room, payload);
        EmitSnapshot(updated, "Etat de la table mis a jour.");
    }

    private void ApplyPrivacyUpdated(JsonElement root)
    {
        if (!root.TryGetProperty("payload", out var payload))
        {
            return;
        }

        bool isPrivate = payload.TryGetProperty("isPrivate", out var isPrivateNode) && isPrivateNode.ValueKind == JsonValueKind.True;
        var updated = CloneSnapshot();
        updated.IsPrivate = isPrivate;
        EmitSnapshot(updated, isPrivate ? "Table en mode prive." : "Table en mode public.");
    }

    private void ApplyRoleUpdated(JsonElement root)
    {
        if (!root.TryGetProperty("payload", out var payload))
        {
            return;
        }

        bool spectator = payload.TryGetProperty("spectator", out var spectatorNode) && spectatorNode.ValueKind == JsonValueKind.True;
        string? message = payload.TryGetProperty("message", out var msgNode) ? msgNode.GetString() : null;
        var updated = CloneSnapshot();
        updated.IsSpectator = spectator;
        EmitSnapshot(updated, string.IsNullOrWhiteSpace(message)
            ? (spectator ? "Mode spectateur active." : "Mode joueur active.")
            : message);
    }

    private RoomSnapshot BuildSnapshotFromRoom(JsonElement room, JsonElement payload)
    {
        var snapshot = CloneSnapshot();
        if (room.TryGetProperty("name", out var nameNode))
        {
            snapshot.RoomName = nameNode.GetString() ?? snapshot.RoomName;
        }
        if (room.TryGetProperty("gameType", out var gameTypeNode))
        {
            snapshot.GameType = gameTypeNode.GetString() ?? snapshot.GameType;
        }
        if (room.TryGetProperty("status", out var statusNode))
        {
            snapshot.Status = statusNode.GetString() ?? snapshot.Status;
        }
        if (room.TryGetProperty("isPrivate", out var privateNode) && privateNode.ValueKind != JsonValueKind.Null)
        {
            snapshot.IsPrivate = privateNode.ValueKind == JsonValueKind.True;
        }
        if (room.TryGetProperty("counts", out var countsNode) && countsNode.ValueKind == JsonValueKind.Object)
        {
            snapshot.PlayersCount = countsNode.TryGetProperty("players", out var playersNode) ? playersNode.GetInt32() : snapshot.PlayersCount;
            snapshot.SpectatorsCount = countsNode.TryGetProperty("spectators", out var spectatorsNode) ? spectatorsNode.GetInt32() : snapshot.SpectatorsCount;
        }
        if (payload.TryGetProperty("bots", out var botsNode) && botsNode.ValueKind == JsonValueKind.Array)
        {
            snapshot.BotsCount = botsNode.GetArrayLength();
        }
        if (room.TryGetProperty("bots", out var roomBots) && roomBots.ValueKind == JsonValueKind.Array)
        {
            snapshot.BotsCount = roomBots.GetArrayLength();
            snapshot.BotIds = ExtractBotIds(roomBots);
        }
        if (room.TryGetProperty("players", out var players) && players.ValueKind == JsonValueKind.Array)
        {
            snapshot.PlayersCount = players.GetArrayLength();
        }
        return snapshot;
    }

    private void EmitSnapshot(RoomSnapshot updated, string history)
    {
        bool changed = HasSnapshotDiff(_snapshot, updated);
        _snapshot = updated;
        if (changed)
        {
            HistoryEvent?.Invoke(history);
        }
        RoomUpdated?.Invoke(updated);
    }

    private static bool HasSnapshotDiff(RoomSnapshot before, RoomSnapshot after)
    {
        return before.RoomId != after.RoomId ||
               before.GameType != after.GameType ||
               before.RoomName != after.RoomName ||
               before.Status != after.Status ||
               before.IsPrivate != after.IsPrivate ||
               before.IsSpectator != after.IsSpectator ||
               before.PlayersCount != after.PlayersCount ||
               before.BotsCount != after.BotsCount ||
               before.SpectatorsCount != after.SpectatorsCount;
    }

    private RoomSnapshot CloneSnapshot()
    {
        return new RoomSnapshot
        {
            RoomId = _snapshot.RoomId,
            GameType = _snapshot.GameType,
            RoomName = _snapshot.RoomName,
            Status = _snapshot.Status,
            IsPrivate = _snapshot.IsPrivate,
            IsSpectator = _snapshot.IsSpectator,
            PlayersCount = _snapshot.PlayersCount,
            BotsCount = _snapshot.BotsCount,
            SpectatorsCount = _snapshot.SpectatorsCount,
            BotIds = new List<int>(_snapshot.BotIds)
        };
    }

    private void HandleError(string message)
    {
        ErrorEvent?.Invoke(message);
        HistoryEvent?.Invoke($"Erreur WS: {message}");
    }

    private void HandleStateChanged(WebSocketState state)
    {
        if (state == WebSocketState.Connected)
        {
            HistoryEvent?.Invoke("Connexion temps reel activee.");
        }
        else if (state == WebSocketState.Error)
        {
            HistoryEvent?.Invoke("Connexion temps reel en erreur.");
        }
        else if (state == WebSocketState.Disconnected)
        {
            HistoryEvent?.Invoke("Connexion temps reel fermee.");
        }
    }

    private static string ExtractErrorMessage(JsonElement root)
    {
        if (root.TryGetProperty("payload", out var payload) &&
            payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty("message", out var msgNode))
        {
            return msgNode.GetString() ?? "Erreur temps reel";
        }
        return "Erreur temps reel";
    }

    private static List<int> ExtractBotIds(JsonElement botsNode)
    {
        var list = new List<int>();
        foreach (var bot in botsNode.EnumerateArray())
        {
            if (bot.ValueKind != JsonValueKind.Object)
            {
                continue;
            }
            if (bot.TryGetProperty("id", out var idNode) && idNode.ValueKind == JsonValueKind.Number)
            {
                list.Add(idNode.GetInt32());
            }
        }
        return list;
    }

    public async ValueTask DisposeAsync()
    {
        _connection.MessageReceived -= HandleMessage;
        _connection.Error -= HandleError;
        _connection.StateChanged -= HandleStateChanged;
        await CloseAsync().ConfigureAwait(false);
        _mutex.Dispose();
    }
}
