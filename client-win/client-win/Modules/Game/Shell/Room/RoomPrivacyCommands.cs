using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Shell.Room;

public sealed class RoomPrivacyCommands : IRoomPrivacyCommands, IDisposable
{
    private readonly RoomSession _session;
    private readonly IDisposable _privacySubscription;

    public RoomPrivacyCommands(RoomSession session, RoomMessageRouter router)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        if (router == null) throw new ArgumentNullException(nameof(router));
        _privacySubscription = router.Subscribe("room.privacy", ctx => HandlePrivacy(ctx.Payload));
    }

    public event Action<bool>? PrivacyChanged;

    public async Task TogglePrivacyAsync(CancellationToken cancellationToken = default)
    {
        await _session.SendCommandAwaitAckAsync(
                "room.toggle-privacy",
                payload: null,
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    public void Dispose()
    {
        _privacySubscription.Dispose();
    }

    private void HandlePrivacy(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
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
}
