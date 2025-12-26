using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomPrivacyCommands : IRoomPrivacyCommands
{
    private readonly RoomSession _session;

    public RoomPrivacyCommands(RoomSession session)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _session.RawMessageReceived += OnRawMessage;
    }

    public event Action<bool>? PrivacyChanged;
    public event Action<string>? ErrorReceived;

    public Task TogglePrivacyAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAsync("room.toggle-privacy", payload: null, cancellationToken);

    public void Dispose()
    {
        _session.RawMessageReceived -= OnRawMessage;
    }

    private void OnRawMessage(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString() ?? string.Empty;

            if (string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
            {
                if (root.TryGetProperty("payload", out var p) &&
                    p.ValueKind == JsonValueKind.Object &&
                    p.TryGetProperty("message", out var m))
                {
                    var msg = m.GetString();
                    if (!string.IsNullOrWhiteSpace(msg))
                    {
                        ErrorReceived?.Invoke(msg);
                    }
                }
                return;
            }

            if (!string.Equals(type, "room.privacy", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("isPrivate", out var isPrivate))
            {
                return;
            }

            var value = isPrivate.ValueKind == JsonValueKind.True ||
                        (isPrivate.ValueKind == JsonValueKind.Number && isPrivate.GetInt32() == 1) ||
                        (isPrivate.ValueKind == JsonValueKind.String &&
                         string.Equals(isPrivate.GetString(), "true", StringComparison.OrdinalIgnoreCase));

            PrivacyChanged?.Invoke(value);
        }
        catch
        {
            // ignore
        }
    }
}

