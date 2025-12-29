using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Chat.Models;
using client_win.Modules.Network.WebSockets;

namespace client_win.Modules.Chat.Services;

/// <summary>
/// Client WebSocket léger pour le tchat (messages de type chat-history / chat-message).
/// </summary>
public sealed class ChatClient : IAsyncDisposable
{
    private readonly Uri _endpoint;
    private readonly IWebSocketConnection _transport;
    private CancellationTokenSource? _cts;

    public event Action<IReadOnlyList<ChatMessage>>? HistoryReceived;
    public event Action<ChatMessage>? MessageReceived;
    public event Action<string>? ErrorReceived;
    public event Action<ChatState>? StateChanged;

    public ChatClient(Uri endpoint, IWebSocketConnection transport)
    {
        _endpoint = endpoint ?? throw new ArgumentNullException(nameof(endpoint));
        _transport = transport ?? throw new ArgumentNullException(nameof(transport));
        _transport.StateChanged += state => SetState(Map(state));
        _transport.Error += msg => ErrorReceived?.Invoke(msg);
        _transport.MessageReceived += HandleRawMessage;
    }

    public async Task ConnectAsync(string token, CancellationToken cancellationToken = default)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        await _transport.ConnectAsync(_endpoint, token, cancellationToken: _cts.Token).ConfigureAwait(false);
    }

    public async Task SendMessageAsync(string text, CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            type = WsMessageTypes.Chat.Send,
            text = text
        };
        string json = JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        await _transport.SendAsync(json, cancellationToken).ConfigureAwait(false);
    }

    private void HandleRawMessage(string raw)
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;
        string type = root.TryGetProperty("type", out var t) ? t.GetString() ?? string.Empty : string.Empty;
        if (type.Equals(WsMessageTypes.Chat.History, StringComparison.OrdinalIgnoreCase))
        {
            var list = new List<ChatMessage>();
            JsonElement? container = null;
            if (root.TryGetProperty("messages", out var msgs))
            {
                container = msgs;
            }
            else if (root.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Array)
            {
                container = payload;
            }
            if (container.HasValue && container.Value.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in container.Value.EnumerateArray())
                {
                    var msg = ParseMessage(item);
                    if (msg != null) list.Add(msg);
                }
            }
            if (list.Count > 0)
            {
                HistoryReceived?.Invoke(list);
            }
        }
        else if (type.Equals(WsMessageTypes.Chat.Message, StringComparison.OrdinalIgnoreCase))
        {
            var msgNode = root.TryGetProperty("payload", out var payload) ? payload : root;
            var msg = ParseMessage(msgNode);
            if (msg != null)
            {
                MessageReceived?.Invoke(msg);
            }
        }
        else if (type.Equals("error", StringComparison.OrdinalIgnoreCase))
        {
            string message = root.TryGetProperty("payload", out var p) &&
                             p.TryGetProperty("message", out var m)
                ? m.GetString() ?? "Erreur tchat"
                : "Erreur tchat";
            ErrorReceived?.Invoke(message);
        }
    }

    private static ChatMessage? ParseMessage(JsonElement element)
    {
        string user = "inconnu";
        if (element.TryGetProperty("user", out var userProp) &&
            userProp.ValueKind == JsonValueKind.Object &&
            userProp.TryGetProperty("username", out var uname))
        {
            user = uname.GetString() ?? "inconnu";
        }
        else if (element.TryGetProperty("from", out var from))
        {
            user = from.GetString() ?? "inconnu";
        }

        string text = element.TryGetProperty("text", out var textProp)
            ? textProp.GetString() ?? string.Empty
            : (element.TryGetProperty("message", out var msg) ? msg.GetString() ?? string.Empty : string.Empty);

        if (string.IsNullOrWhiteSpace(text)) return null;

        DateTime timestamp = DateTime.UtcNow;
        if (element.TryGetProperty("createdAt", out var createdProp) && createdProp.TryGetDateTime(out var created))
        {
            timestamp = created;
        }
        else if (element.TryGetProperty("at", out var atProp) && atProp.TryGetDateTime(out var dt))
        {
            timestamp = dt;
        }

        return new ChatMessage(user, text, timestamp);
    }

    private void SetState(ChatState state) => StateChanged?.Invoke(state);

    private static ChatState Map(global::client_win.Modules.Network.WebSockets.WebSocketState state) =>
        state switch
        {
            global::client_win.Modules.Network.WebSockets.WebSocketState.Connecting => ChatState.Connecting,
            global::client_win.Modules.Network.WebSockets.WebSocketState.Connected => ChatState.Connected,
            global::client_win.Modules.Network.WebSockets.WebSocketState.Error => ChatState.Error,
            _ => ChatState.Disconnected
        };

    public async ValueTask DisposeAsync()
    {
        if (_cts != null)
        {
            _cts.Cancel();
            _cts.Dispose();
            _cts = null;
        }
        await _transport.DisposeAsync().ConfigureAwait(false);
    }
}
