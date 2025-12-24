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

namespace client_win.Modules.Game.Services;

public sealed class RoomRealtimeService : IRoomRealtimeService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly IWebSocketConnection _connection;
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly ErrorBus? _errors;
    private readonly SemaphoreSlim _mutex = new(1, 1);

    public RoomRealtimeService(IWebSocketConnection connection, ClientConfiguration config, ISessionService session, ErrorBus? errors = null)
    {
        _connection = connection ?? throw new ArgumentNullException(nameof(connection));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _errors = errors;
    }

    public async Task<CreatedRoom?> CreateRoomAsync(CreateRoomRequest request, CancellationToken cancellationToken = default)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.GameType))
        {
            return null;
        }

        await _mutex.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var token = _session.CurrentUser?.Token;
            if (string.IsNullOrWhiteSpace(token))
            {
                _errors?.Publish(new AppError("Authentification requise pour creer une table.", ErrorSeverity.Warning, context: "room.create"));
                return null;
            }

            var headers = new Dictionary<string, string>();
            if (!string.IsNullOrWhiteSpace(_config.SharedSecret))
            {
                headers["x-lila-ws-signature"] = _config.SharedSecret!;
            }

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(10));

            var tcs = new TaskCompletionSource<CreatedRoom?>(TaskCreationOptions.RunContinuationsAsynchronously);
            void HandleError(string message)
            {
                tcs.TrySetException(new InvalidOperationException(message));
            }

            void HandleMessage(string raw)
            {
                try
                {
                    using var doc = JsonDocument.Parse(raw);
                    var root = doc.RootElement;
                    string type = root.TryGetProperty("type", out var typeNode) ? typeNode.GetString() ?? string.Empty : string.Empty;
                    if (string.Equals(type, "room.created", StringComparison.OrdinalIgnoreCase))
                    {
                        int roomId = ExtractRoomId(root);
                        var payload = root.TryGetProperty("payload", out var payloadNode) ? payloadNode : default;
                        var roomNode = payload.ValueKind != JsonValueKind.Undefined && payload.TryGetProperty("room", out var r) ? r : default;
                        string gameType = roomNode.ValueKind != JsonValueKind.Undefined && roomNode.TryGetProperty("gameType", out var gt)
                            ? gt.GetString() ?? string.Empty
                            : string.Empty;
                        string roomName = roomNode.ValueKind != JsonValueKind.Undefined && roomNode.TryGetProperty("name", out var name)
                            ? name.GetString() ?? string.Empty
                            : string.Empty;
                        tcs.TrySetResult(new CreatedRoom(roomId, gameType, roomName));
                        return;
                    }

                    if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
                    {
                        string message = "Erreur temps réel";
                        if (root.TryGetProperty("payload", out var payloadNode) &&
                            payloadNode.ValueKind == JsonValueKind.Object &&
                            payloadNode.TryGetProperty("message", out var msgNode))
                        {
                            message = msgNode.GetString() ?? message;
                        }
                        tcs.TrySetException(new InvalidOperationException(message));
                    }
                }
                catch (Exception ex)
                {
                    tcs.TrySetException(ex);
                }
            }

            _connection.MessageReceived += HandleMessage;
            _connection.Error += HandleError;

            try
            {
                await _connection.ConnectAsync(_config.RealtimeGatewayWs, token, headers, timeoutCts.Token).ConfigureAwait(false);
                var payload = new
                {
                    gameType = request.GameType,
                    name = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name,
                    maxPlayers = request.MaxPlayers,
                    isPrivate = request.IsPrivate
                };
                string message = JsonSerializer.Serialize(new { type = "room.create", payload }, SerializerOptions);
                await _connection.SendAsync(message, timeoutCts.Token).ConfigureAwait(false);

                using var registration = timeoutCts.Token.Register(() => tcs.TrySetCanceled(timeoutCts.Token));
                return await tcs.Task.ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                _errors?.Publish(new AppError("Creation de table expiree.", ErrorSeverity.Warning, context: "room.create"));
                return null;
            }
            catch (Exception ex)
            {
                _errors?.Publish(new AppError("Creation de table impossible.", ErrorSeverity.Warning, context: "room.create", detail: ex.Message));
                return null;
            }
            finally
            {
                _connection.MessageReceived -= HandleMessage;
                _connection.Error -= HandleError;
                await _connection.CloseAsync().ConfigureAwait(false);
            }
        }
        finally
        {
            _mutex.Release();
        }
    }

    private static int ExtractRoomId(JsonElement root)
    {
        if (root.TryGetProperty("roomId", out var roomIdNode) && roomIdNode.ValueKind == JsonValueKind.Number)
        {
            return roomIdNode.GetInt32();
        }

        if (root.TryGetProperty("payload", out var payload) &&
            payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty("room", out var roomNode) &&
            roomNode.ValueKind == JsonValueKind.Object &&
            roomNode.TryGetProperty("id", out var idNode) &&
            idNode.ValueKind == JsonValueKind.Number)
        {
            return idNode.GetInt32();
        }

        return 0;
    }
}
