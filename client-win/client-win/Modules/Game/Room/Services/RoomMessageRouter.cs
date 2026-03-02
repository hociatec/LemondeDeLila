using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomMessageRouter : IDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly RoomSession _session;
    private readonly Dictionary<string, List<Action<RoomMessageContext>>> _handlers = new(StringComparer.Ordinal);
    private readonly object _lock = new();

    public RoomMessageRouter(RoomSession session)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _session.RawMessageReceived += OnRawMessage;
    }

    public IDisposable Subscribe(string type, Action<RoomMessageContext> handler)
    {
        if (string.IsNullOrWhiteSpace(type)) throw new ArgumentException("type requis", nameof(type));
        if (handler == null) throw new ArgumentNullException(nameof(handler));

        var normalized = NormalizeType(type);
        lock (_lock)
        {
            if (!_handlers.TryGetValue(normalized, out var list))
            {
                list = new List<Action<RoomMessageContext>>();
                _handlers[normalized] = list;
            }
            list.Add(handler);
        }

        return new Subscription(this, normalized, handler);
    }

    private void OnRawMessage(string raw)
    {
        if (!TryParse(raw, out var context))
        {
            return;
        }

        List<Action<RoomMessageContext>>? subscribers;
        lock (_lock)
        {
            if (!_handlers.TryGetValue(context.Type, out var list))
            {
                return;
            }
            subscribers = list.ToList();
        }

        if (subscribers == null || subscribers.Count == 0)
        {
            return;
        }

        foreach (var handler in subscribers)
        {
            try
            {
                handler(context);
            }
            catch
            {
                // ignore individual handler errors
            }
        }
    }

    private static bool TryParse(string raw, out RoomMessageContext context)
    {
        context = default;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (!root.TryGetProperty("type", out var typeProp) ||
                typeProp.ValueKind != JsonValueKind.String)
            {
                return false;
            }

            var type = (typeProp.GetString() ?? string.Empty).Trim();
            if (type.Length == 0)
            {
                return false;
            }

            var normalizedType = NormalizeType(type);
            var payload = default(JsonElement);
            var hasPayload = false;
            if (root.TryGetProperty("payload", out var payloadProp))
            {
                payload = payloadProp;
                hasPayload = true;
            }

            context = new RoomMessageContext(normalizedType, type, payload, hasPayload, raw);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string NormalizeType(string type) =>
        (type ?? string.Empty).Trim().ToLowerInvariant();

    private void Unsubscribe(string normalizedType, Action<RoomMessageContext> handler)
    {
        lock (_lock)
        {
            if (!_handlers.TryGetValue(normalizedType, out var list))
            {
                return;
            }
            list.Remove(handler);
            if (list.Count == 0)
            {
                _handlers.Remove(normalizedType);
            }
        }
    }

    public void Dispose()
    {
        _session.RawMessageReceived -= OnRawMessage;
        lock (_lock)
        {
            _handlers.Clear();
        }
    }

    public readonly struct RoomMessageContext
    {
        public RoomMessageContext(
            string type,
            string originalType,
            JsonElement payload,
            bool hasPayload,
            string raw)
        {
            Type = type;
            OriginalType = originalType;
            Payload = payload;
            HasPayload = hasPayload;
            Raw = raw;
        }

        public string Type { get; }
        public string OriginalType { get; }
        public JsonElement Payload { get; }
        public bool HasPayload { get; }
        public string Raw { get; }
    }

    private sealed class Subscription : IDisposable
    {
        private readonly RoomMessageRouter _router;
        private readonly string _type;
        private readonly Action<RoomMessageContext> _handler;
        private bool _disposed;

        public Subscription(RoomMessageRouter router, string type, Action<RoomMessageContext> handler)
        {
            _router = router;
            _type = type;
            _handler = handler;
        }

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }
            _disposed = true;
            _router.Unsubscribe(_type, _handler);
        }
    }
}
