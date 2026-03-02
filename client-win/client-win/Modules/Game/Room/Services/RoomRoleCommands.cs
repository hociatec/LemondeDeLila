using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomRoleCommands : IRoomRoleCommands, IDisposable
{
    private readonly RoomSession _session;
    private readonly IDisposable _roleSubscription;
    private bool _isSpectator;

    public RoomRoleCommands(RoomSession session, RoomMessageRouter router)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        if (router == null) throw new ArgumentNullException(nameof(router));
        _roleSubscription = router.Subscribe("room.role", ctx => HandleRole(ctx.Payload));
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
        _roleSubscription.Dispose();
    }

    private void HandleRole(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
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
}
