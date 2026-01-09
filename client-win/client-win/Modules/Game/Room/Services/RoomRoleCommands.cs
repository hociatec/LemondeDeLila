using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomRoleCommands : IRoomRoleCommands
{
    private readonly RoomSession _session;
    private bool _isSpectator;

    public RoomRoleCommands(RoomSession session)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _session.RawMessageReceived += OnRawMessage;
    }

    public event Action<bool>? RoleChanged;

    public bool IsSpectator => _isSpectator;

    public Task ToggleRoleAsync(CancellationToken cancellationToken = default)
    {
        var next = !_isSpectator;
        return SetSpectatorAsync(next, cancellationToken);
    }

    public Task ToggleRoleAsync(bool currentIsSpectator, CancellationToken cancellationToken = default)
    {
        return SetSpectatorAsync(!currentIsSpectator, cancellationToken);
    }

    public Task SetSpectatorAsync(bool spectator, CancellationToken cancellationToken = default)
    {
        return _session.SendCommandAsync("room.set-role", payload: new { spectator }, cancellationToken);
    }

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

            if (!string.Equals(type, "room.role", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("spectator", out var spectatorProp))
            {
                return;
            }

            var spectator = spectatorProp.ValueKind == JsonValueKind.True ||
                            (spectatorProp.ValueKind == JsonValueKind.Number && spectatorProp.GetInt32() == 1) ||
                            (spectatorProp.ValueKind == JsonValueKind.String &&
                             string.Equals(spectatorProp.GetString(), "true", StringComparison.OrdinalIgnoreCase));

            if (spectator == _isSpectator)
            {
                return;
            }

            _isSpectator = spectator;
            RoleChanged?.Invoke(_isSpectator);
        }
        catch
        {
            // ignore
        }
    }
}
