using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Network.WebSockets;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomClient : IRoomFacade
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly IRoomSession _session;
    private readonly IRoomAnnouncements _announcements;
    private bool _isSpectator;

    public RoomClient(IRoomSession session, IRoomAnnouncements announcements)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        _session.RoomUpdated += OnRoomUpdated;
        _session.ConnectionStateChanged += OnConnectionStateChanged;
        _session.ErrorReceived += OnErrorReceived;
        _session.Left += OnLeft;
        _session.RawMessageReceived += OnRawMessage;
    }

    public RoomPayloadDto? CurrentPayload => _session.LastRoomState;

    public bool IsSpectator => _isSpectator;

    public event Action<RoomPayloadDto>? RoomUpdated;
    public event Action<string>? ErrorReceived;
    public event Action<string>? Left;
    public event Action<WebSocketState>? ConnectionStateChanged;
    public event Action<RoomAnnouncement>? AnnouncementReceived;
    public event Action<string>? InfoReceived;
    public event Action<string>? BotJoined;
    public event Action<string>? BotRemoved;
    public event Action<bool>? PrivacyChanged;
    public event Action<bool>? RoleChanged;
    public event Action<RoomChatMessageDto>? ChatMessageReceived;
    public event Action<IReadOnlyList<RoomChatMessageDto>>? ChatHistoryReceived;
    public event Action<JsonElement>? IntentReceived;

    public Task AddBotAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAwaitAckAsync("bot.add", payload: null, cancellationToken: cancellationToken);

    public Task RemoveBotAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAwaitAckAsync("bot.remove", payload: null, cancellationToken: cancellationToken);

    public Task TogglePrivacyAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAwaitAckAsync("room.toggle-privacy", payload: null, cancellationToken: cancellationToken);

    public Task ToggleRoleAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAwaitAckAsync("room.set-role", payload: new { spectator = !_isSpectator }, cancellationToken: cancellationToken);

    public Task RequestInfoAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAsync("room.info", payload: null, cancellationToken: cancellationToken);

    public Task RequestChatHistoryAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAsync("room.chat.history", payload: null, cancellationToken: cancellationToken);

    public Task SendChatMessageAsync(string message, CancellationToken cancellationToken = default)
    {
        var payload = new { message = (message ?? string.Empty).Trim() };
        return _session.SendCommandAsync("room.chat.send", payload, cancellationToken);
    }

    public void PublishAnnouncement(RoomAnnouncement announcement)
    {
        if (announcement == null)
        {
            return;
        }

        try
        {
            _announcements.Publish(announcement);
            AnnouncementReceived?.Invoke(announcement);
        }
        catch
        {
        }
    }

    public Task RequestStateRefreshAsync(bool force = false) => _session.RequestStateRefreshAsync(force);

    public Task LeaveAsync(CancellationToken cancellationToken = default) => _session.LeaveAsync(cancellationToken);

    public async ValueTask DisposeAsync()
    {
        _session.RoomUpdated -= OnRoomUpdated;
        _session.ConnectionStateChanged -= OnConnectionStateChanged;
        _session.ErrorReceived -= OnErrorReceived;
        _session.Left -= OnLeft;
        _session.RawMessageReceived -= OnRawMessage;
        await _session.DisposeAsync().ConfigureAwait(false);
    }

    private void OnRoomUpdated(RoomPayloadDto payload) => RoomUpdated?.Invoke(payload);

    private void OnConnectionStateChanged(WebSocketState state) => ConnectionStateChanged?.Invoke(state);

    private void OnErrorReceived(string message)
    {
        if (!string.IsNullOrWhiteSpace(message))
        {
            ErrorReceived?.Invoke(message);
        }
    }

    private void OnLeft(string reason) => Left?.Invoke(reason);

    private void OnRawMessage(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return;
        }

        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!root.TryGetProperty("type", out var typeProp) ||
                typeProp.ValueKind != JsonValueKind.String)
            {
                return;
            }

            var type = (typeProp.GetString() ?? string.Empty).Trim();
            if (type.Length == 0)
            {
                return;
            }

            var normalized = type.ToLowerInvariant();
            var payload = root.TryGetProperty("payload", out var payloadProp)
                ? payloadProp
                : default;

            switch (normalized)
            {
                case "room.intent":
                    IntentReceived?.Invoke(payload);
                    break;
                case "room.chat.message":
                    HandleChatMessage(payload);
                    break;
                case "room.chat.history":
                    HandleChatHistory(payload);
                    break;
                case "room.privacy":
                    if (TryReadBoolean(payload, "isPrivate", out var visibility))
                    {
                        _announcements.VisibilityChanged(visibility);
                        PrivacyChanged?.Invoke(visibility);
                    }
                    break;
                case "room.role":
                    if (TryReadBoolean(payload, "spectator", out var spectator))
                    {
                        if (_isSpectator != spectator)
                        {
                            _isSpectator = spectator;
                            _announcements.RoleChanged(spectator);
                            RoleChanged?.Invoke(spectator);
                        }
                    }
                    break;
                case "room.info":
                    if (TryReadString(payload, "message", out var info))
                    {
                        _announcements.TableInfo(info);
                        InfoReceived?.Invoke(info);
                    }
                    break;
                case "bot.added":
                    HandleBotEvent(payload, added: true);
                    break;
                case "bot.removed":
                    HandleBotEvent(payload, added: false);
                    break;
                default:
                    break;
            }
        }
        catch
        {
            // Ignore malformed messages.
        }
    }

    private void HandleChatMessage(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        var message = payload.Deserialize<RoomChatMessageDto>(_json);
        if (message == null || string.IsNullOrWhiteSpace(message.Message))
        {
            return;
        }

        ChatMessageReceived?.Invoke(message);
    }

    private void HandleChatHistory(JsonElement payload)
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
            ChatHistoryReceived?.Invoke(messages);
        }
    }

    private void HandleBotEvent(JsonElement payload, bool added)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        var name = TryGetBotName(payload);
        if (string.IsNullOrWhiteSpace(name))
        {
            return;
        }

        if (added)
        {
            _announcements.BotJoined(name);
            BotJoined?.Invoke(name);
        }
        else
        {
            _announcements.BotLeft(name);
            BotRemoved?.Invoke(name);
        }
    }

    private static bool TryReadBoolean(JsonElement element, string propertyName, out bool value)
    {
        value = false;
        if (element.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!element.TryGetProperty(propertyName, out var property))
        {
            return false;
        }

        if (property.ValueKind == JsonValueKind.True)
        {
            value = true;
            return true;
        }

        if (property.ValueKind == JsonValueKind.False)
        {
            value = false;
            return true;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var number))
        {
            value = number != 0;
            return true;
        }

        if (property.ValueKind == JsonValueKind.String)
        {
            var text = property.GetString();
            if (string.IsNullOrWhiteSpace(text))
            {
                return false;
            }

            value = string.Equals(text.Trim(), "true", StringComparison.OrdinalIgnoreCase);
            return true;
        }

        return false;
    }

    private static bool TryReadString(JsonElement element, string propertyName, out string value)
    {
        value = string.Empty;
        if (element.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!element.TryGetProperty(propertyName, out var property) ||
            property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = property.GetString()?.Trim() ?? string.Empty;
        return value.Length > 0;
    }

    private static string? TryGetBotName(JsonElement element)
    {
        try
        {
            if (element.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (!element.TryGetProperty("bot", out var botProp) ||
                botProp.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (!botProp.TryGetProperty("name", out var nameProp) ||
                nameProp.ValueKind != JsonValueKind.String)
            {
                return null;
            }

            return nameProp.GetString();
        }
        catch
        {
            return null;
        }
    }
}

