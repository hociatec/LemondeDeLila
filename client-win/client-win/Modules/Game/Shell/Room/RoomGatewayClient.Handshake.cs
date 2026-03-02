using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Common;
using client_win.Modules.Network.WebSockets;
using Serilog;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Shell.Room;

public sealed partial class RoomGatewayClient
{
    private static async Task<RoomEnvelope<RoomPayloadDto>> WaitRoomCreatedAsync(
        IWebSocketConnection socket,
        string gameType,
        CancellationToken cancellationToken)
    {
        var tcs = new TaskCompletionSource<RoomEnvelope<RoomPayloadDto>>(TaskCreationOptions.RunContinuationsAsynchronously);
        var connected = false;
        var startedAt = DateTime.UtcNow;

        void OnMessage(string raw)
        {
            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (!doc.RootElement.TryGetProperty("type", out var typeProp) ||
                    typeProp.ValueKind != JsonValueKind.String)
                {
                    return;
                }

                var type = typeProp.GetString() ?? string.Empty;
                if (string.Equals(type, "room.pong", StringComparison.OrdinalIgnoreCase))
                {
                    TryUpdateClockFromPong(doc.RootElement);
                    return;
                }
                if (string.Equals(type, "room.created", StringComparison.OrdinalIgnoreCase))
                {
                    var msg = JsonSerializer.Deserialize<RoomEnvelope<RoomPayloadDto>>(raw, _json);
                    if (msg != null)
                    {
                        tcs.TrySetResult(msg);
                    }
                    return;
                }

                if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
                {
                    string? message = null;
                    if (doc.RootElement.TryGetProperty("payload", out var payload) &&
                        payload.ValueKind == JsonValueKind.Object &&
                        payload.TryGetProperty("message", out var messageProp) &&
                        messageProp.ValueKind == JsonValueKind.String)
                    {
                        message = messageProp.GetString();
                    }

                    tcs.TrySetException(new InvalidOperationException(
                        string.IsNullOrWhiteSpace(message) ? "Erreur création de table." : message));
                }
            }
            catch
            {
                // ignore
            }
        }

        void OnError(string message)
        {
            if (tcs.Task.IsCompleted) return;
            tcs.TrySetException(new InvalidOperationException(message));
        }

        void OnStateChanged(WebSocketState state)
        {
            if (tcs.Task.IsCompleted) return;
            if (!connected) return;
            if (state is WebSocketState.Error or WebSocketState.Disconnected)
            {
                tcs.TrySetException(new InvalidOperationException(
                    "Connexion WebSocket fermée pendant la création de table. Vérifiez la connectivité WS."));
            }
        }

        socket.MessageReceived += OnMessage;
        socket.Error += OnError;
        socket.StateChanged += OnStateChanged;

        try
        {
            await TrySyncClockAsync(socket, cancellationToken).ConfigureAwait(false);

            var trace = new { id = Guid.NewGuid().ToString("N"), sentAtMs = ServerClock.NowServerMs() };
            var create = JsonSerializer.Serialize(
                new { type = "room.create", payload = new { gameType, _trace = trace } },
                _json);
            await socket.SendAsync(create, cancellationToken).ConfigureAwait(false);
            connected = true;

            using var timeout = new CancellationTokenSource(GameTiming.Room.GatewayConnectTimeout);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            var res = await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
            Log.Information("WS room.create: réponse reçue en {ElapsedMs}ms (roomId={RoomId})", (DateTime.UtcNow - startedAt).TotalMilliseconds, res.RoomId);
            return res;
        }
        catch (OperationCanceledException)
        {
            throw new InvalidOperationException("Timeout création de table.");
        }
        finally
        {
            socket.MessageReceived -= OnMessage;
            socket.Error -= OnError;
            socket.StateChanged -= OnStateChanged;
        }
    }

    private static async Task<RoomEnvelope<RoomPayloadDto>> WaitRoomStateAsync(
        IWebSocketConnection socket,
        CancellationToken cancellationToken)
    {
        var tcs = new TaskCompletionSource<RoomEnvelope<RoomPayloadDto>>(TaskCreationOptions.RunContinuationsAsynchronously);
        var connected = false;
        var startedAt = DateTime.UtcNow;

        void OnMessage(string raw)
        {
            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (!doc.RootElement.TryGetProperty("type", out var typeProp) ||
                    typeProp.ValueKind != JsonValueKind.String)
                {
                    return;
                }

                var type = typeProp.GetString() ?? string.Empty;
                if (string.Equals(type, "room.pong", StringComparison.OrdinalIgnoreCase))
                {
                    TryUpdateClockFromPong(doc.RootElement);
                    return;
                }
                if (string.Equals(type, "room.updated", StringComparison.OrdinalIgnoreCase))
                {
                    var msg = JsonSerializer.Deserialize<RoomEnvelope<RoomPayloadDto>>(raw, _json);
                    if (msg != null)
                    {
                        tcs.TrySetResult(msg);
                    }
                    return;
                }

                if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
                {
                    string? message = null;
                    if (doc.RootElement.TryGetProperty("payload", out var payload) &&
                        payload.ValueKind == JsonValueKind.Object &&
                        payload.TryGetProperty("message", out var messageProp) &&
                        messageProp.ValueKind == JsonValueKind.String)
                    {
                        message = messageProp.GetString();
                    }

                    tcs.TrySetException(new InvalidOperationException(
                        string.IsNullOrWhiteSpace(message) ? "Erreur connexion table." : message));
                }
            }
            catch
            {
                // ignore
            }
        }

        void OnError(string message)
        {
            if (tcs.Task.IsCompleted) return;
            tcs.TrySetException(new InvalidOperationException(message));
        }

        void OnStateChanged(WebSocketState state)
        {
            if (tcs.Task.IsCompleted) return;
            if (!connected) return;
            if (state is WebSocketState.Error or WebSocketState.Disconnected)
            {
                tcs.TrySetException(new InvalidOperationException(
                    "Connexion WebSocket fermée pendant la connexion à la table. Vérifiez la connectivité WS."));
            }
        }

        socket.MessageReceived += OnMessage;
        socket.Error += OnError;
        socket.StateChanged += OnStateChanged;

        try
        {
            connected = true;

            using var timeout = new CancellationTokenSource(GameTiming.Room.GatewayConnectTimeout);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            var res = await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
            Log.Information("WS room.connect: état reçu en {ElapsedMs}ms (roomId={RoomId})", (DateTime.UtcNow - startedAt).TotalMilliseconds, res.RoomId);
            return res;
        }
        catch (OperationCanceledException)
        {
            throw new InvalidOperationException("Timeout connexion table.");
        }
        finally
        {
            socket.MessageReceived -= OnMessage;
            socket.Error -= OnError;
            socket.StateChanged -= OnStateChanged;
        }
    }

    private static bool IsTransientCreateFailure(Exception ex)
    {
        if (ex is OperationCanceledException)
        {
            return false;
        }

        var message = (ex.Message ?? string.Empty).Trim();
        if (message.Length == 0)
        {
            return false;
        }

        return message.Contains("WebSocket ferm", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("Timeout cr", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("Connexion table", StringComparison.OrdinalIgnoreCase);
    }

    private static Uri BuildRoomUri(Uri baseWs, int roomId, bool spectator = false, bool silent = false)
    {
        var builder = new UriBuilder(baseWs);
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(builder.Query))
        {
            query.Add(builder.Query.TrimStart('?'));
        }
        if (roomId > 0)
        {
            query.Add($"room={roomId}");
            if (spectator)
            {
                query.Add("spectator=1");
            }
            if (silent)
            {
                // Admin hidden join (backward compat: server still accepts `silent=1` too).
                query.Add("hidden=1");
            }
        }
        builder.Query = string.Join("&", query);
        return builder.Uri;
    }

    private static async Task TrySyncClockAsync(IWebSocketConnection socket, CancellationToken cancellationToken)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        void OnMessage(string raw)
        {
            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (!doc.RootElement.TryGetProperty("type", out var typeProp) ||
                    typeProp.ValueKind != JsonValueKind.String)
                {
                    return;
                }

                var type = typeProp.GetString() ?? string.Empty;
                if (!string.Equals(type, "room.pong", StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                if (TryUpdateClockFromPong(doc.RootElement))
                {
                    tcs.TrySetResult(true);
                }
            }
            catch
            {
                // ignore
            }
        }

        socket.MessageReceived += OnMessage;

        try
        {
            var ping = JsonSerializer.Serialize(
                new { type = "room.ping", payload = new { clientSentAtMs = ServerClock.UtcNowMs() } },
                _json);
            await socket.SendAsync(ping, cancellationToken).ConfigureAwait(false);

            using var timeout = new CancellationTokenSource(GameTiming.Room.ClockSyncTimeout);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
            await tcs.Task.WaitAsync(linked.Token).ConfigureAwait(false);
        }
        catch
        {
            // Best-effort: si le ping échoue ou timeout, on continue quand même.
        }
        finally
        {
            socket.MessageReceived -= OnMessage;
        }
    }

    private static bool TryUpdateClockFromPong(JsonElement root)
    {
        var receivedAtMs = ServerClock.UtcNowMs();

        try
        {
            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (!payload.TryGetProperty("serverTimeMs", out var serverTimeProp) ||
                serverTimeProp.ValueKind != JsonValueKind.Number)
            {
                return false;
            }

            if (!payload.TryGetProperty("clientSentAtMs", out var clientSentProp) ||
                clientSentProp.ValueKind != JsonValueKind.Number)
            {
                return false;
            }

            var serverTimeMs = serverTimeProp.GetInt64();
            var clientSentAtMs = clientSentProp.GetInt64();
            ServerClock.UpdateFromPong(serverTimeMs, clientSentAtMs, receivedAtMs);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<IDictionary<string, string>?> BuildHeadersAsync(CancellationToken cancellationToken)
    {
        var ticket = await _tickets.GetTicketAsync("room", cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(ticket))
        {
            return null;
        }
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["x-lila-ws-ticket"] = ticket
        };
    }
}
