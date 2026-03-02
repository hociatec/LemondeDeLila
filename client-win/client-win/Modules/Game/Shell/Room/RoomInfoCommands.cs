using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Shell.Room;

public sealed class RoomInfoCommands : IDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly RoomSession _session;
    private readonly IDisposable _infoSubscription;

    public RoomInfoCommands(RoomSession session, RoomMessageRouter router)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        if (router == null) throw new ArgumentNullException(nameof(router));
        _infoSubscription = router.Subscribe("room.info", ctx => HandleInfo(ctx.Payload));
    }

    public event Action<string>? InfoReceived;

    public Task RequestInfoAsync(CancellationToken cancellationToken = default) =>
        _session.SendCommandAsync("room.info", payload: null, cancellationToken: cancellationToken);

    public void Dispose()
    {
        _infoSubscription.Dispose();
    }

    private void HandleInfo(JsonElement payload)
    {
        if (payload.ValueKind == JsonValueKind.Undefined || payload.ValueKind == JsonValueKind.Null)
        {
            return;
        }

        var message = payload.Deserialize<RoomInfoPayloadDto>(_json)?.Message;
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        InfoReceived?.Invoke(message.Trim());
    }

    private sealed class RoomInfoPayloadDto
    {
        public string? Message { get; set; }
    }
}
