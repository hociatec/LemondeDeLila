using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Shell.Room;

public sealed class RoomBotCommands : IRoomBotCommands, IDisposable
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly RoomSession _session;
    private readonly IDisposable _botAddedSubscription;
    private readonly IDisposable _botRemovedSubscription;

    public RoomBotCommands(RoomSession session, RoomMessageRouter router)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        if (router == null) throw new ArgumentNullException(nameof(router));
        _botAddedSubscription = router.Subscribe("bot.added", ctx => HandleBotEvent(ctx.Payload, BotAdded));
        _botRemovedSubscription = router.Subscribe("bot.removed", ctx => HandleBotEvent(ctx.Payload, BotRemoved));
    }

    public event Action<string>? BotAdded;
    public event Action<string>? BotRemoved;

    public async Task AddBotAsync(CancellationToken cancellationToken = default)
    {
        await _session.SendCommandAwaitAckAsync(
                "bot.add",
                payload: null,
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task RemoveLastBotAsync(CancellationToken cancellationToken = default)
    {
        await _session.SendCommandAwaitAckAsync(
                "bot.remove",
                payload: null,
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    public void Dispose()
    {
        _botAddedSubscription.Dispose();
        _botRemovedSubscription.Dispose();
    }
    private static void HandleBotEvent(JsonElement payload, Action<string>? callback)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        var name = TryReadBotName(payload);
        if (!string.IsNullOrWhiteSpace(name))
        {
            callback?.Invoke(name);
        }
    }
    private static string? TryReadBotName(JsonElement element)
    {
        try
        {
            if (element.ValueKind != JsonValueKind.Object) return null;
            if (!element.TryGetProperty("bot", out var bot)) return null;
            if (bot.ValueKind != JsonValueKind.Object) return null;
            if (!bot.TryGetProperty("name", out var name)) return null;
            return name.GetString();
        }
        catch
        {
            return null;
        }
    }
}
