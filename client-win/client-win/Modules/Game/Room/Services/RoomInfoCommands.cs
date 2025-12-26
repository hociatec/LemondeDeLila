using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomInfoCommands : IDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly RoomSession _session;

    public RoomInfoCommands(RoomSession session)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _session.RawMessageReceived += OnRawMessageReceived;
    }

    public event Action<string>? InfoReceived;

    public Task RequestInfoAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAsync("room.info", payload: null, cancellationToken: cancellationToken);

    public void Dispose()
    {
        _session.RawMessageReceived -= OnRawMessageReceived;
    }

    private void OnRawMessageReceived(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString() ?? string.Empty;
            if (!string.Equals(type, "room.info", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payloadProp) ||
                payloadProp.ValueKind == JsonValueKind.Undefined ||
                payloadProp.ValueKind == JsonValueKind.Null)
            {
                return;
            }

            var payload = payloadProp.Deserialize<RoomInfoPayloadDto>(_json);
            var message = payload?.Message;
            if (string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            InfoReceived?.Invoke(message.Trim());
        }
        catch
        {
            // Ignore parse errors (best effort).
        }
    }

    private sealed class RoomInfoPayloadDto
    {
        public string? Message { get; set; }
    }
}
