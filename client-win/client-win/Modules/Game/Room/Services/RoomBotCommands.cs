using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomBotCommands : IRoomBotCommands
{
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly RoomSession _session;

    public RoomBotCommands(RoomSession session)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _session.RawMessageReceived += OnRawMessage;
    }

    public event Action<string>? BotAdded;
    public event Action<string>? BotRemoved;

    public async Task AddBotAsync(CancellationToken cancellationToken = default)
    {
        await _session.SendCommandAwaitAckAsync(
                "bot.add",
                payload: null,
                ackTimeout: TimeSpan.FromMilliseconds(350),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task RemoveLastBotAsync(CancellationToken cancellationToken = default)
    {
        await _session.SendCommandAwaitAckAsync(
                "bot.remove",
                payload: null,
                ackTimeout: TimeSpan.FromMilliseconds(350),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
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

            if (string.Equals(type, "bot.added", StringComparison.OrdinalIgnoreCase))
            {
                if (root.TryGetProperty("payload", out var payloadEl))
                {
                    var name = TryReadBotName(payloadEl);
                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        BotAdded?.Invoke(name);
                    }
                }
                return;
            }

            if (string.Equals(type, "bot.removed", StringComparison.OrdinalIgnoreCase))
            {
                if (root.TryGetProperty("payload", out var payloadEl))
                {
                    var name = TryReadBotName(payloadEl);
                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        BotRemoved?.Invoke(name);
                    }
                }
            }
        }
        catch
        {
            // ignore
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
