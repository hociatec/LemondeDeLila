using System;
using System.Text.Json;
using client_win.Modules.Game.History.Services;
using client_win.Modules.Game.Room.Services;
using client_win.Modules.Game.Shell.Models;
using client_win.Modules.Game.Shell.ViewModels;

namespace client_win.Modules.Game.Shell.Services;

internal sealed class RoomIntentDispatcher
{
    private readonly GameRoomViewModel _roomVm;
    private readonly IGameHistorySink _history;
    private readonly IRoomAnnouncements _announcements;

    public RoomIntentDispatcher(
        GameRoomViewModel roomVm,
        IGameHistorySink history,
        IRoomAnnouncements announcements)
    {
        _roomVm = roomVm ?? throw new ArgumentNullException(nameof(roomVm));
        _history = history ?? throw new ArgumentNullException(nameof(history));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
    }

    public void HandleIntent(JsonElement payload)
    {
        if (!TryReadIntent(payload, out var type, out var intentPayload))
        {
            return;
        }

        switch (type)
        {
            case "focus":
                HandleFocusIntent(intentPayload);
                break;
            case "history":
                HandleHistoryIntent(intentPayload);
                break;

            case "announcement":
                HandleAnnouncementIntent(intentPayload);
                break;

            case "start-wizard":
                HandleStartConfigIntent(intentPayload);
                break;
            default:
                break;
        }
    }

    private static bool TryReadIntent(JsonElement element, out string type, out JsonElement payload)
    {
        type = string.Empty;
        payload = default;
        if (element.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!element.TryGetProperty("type", out var typeProp) ||
            typeProp.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        type = (typeProp.GetString() ?? string.Empty).Trim().ToLowerInvariant();
        if (type.Length == 0)
        {
            return false;
        }

        if (!element.TryGetProperty("payload", out payload))
        {
            payload = default;
        }

        return true;
    }

    private void HandleAnnouncementIntent(JsonElement payload)
    {
        if (!payload.TryGetProperty("message", out var messageProp) ||
            messageProp.ValueKind != JsonValueKind.String)
        {
            return;
        }

        var message = messageProp.GetString();
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }
        if (ShouldIgnoreAnnouncement(message))
        {
            return;
        }

        var priority = RoomAnnouncementKind.Polite;
        if (payload.TryGetProperty("priority", out var priorityProp) &&
            priorityProp.ValueKind == JsonValueKind.String &&
            string.Equals(priorityProp.GetString(), "assertive", StringComparison.OrdinalIgnoreCase))
        {
            priority = RoomAnnouncementKind.Assertive;
        }

        _announcements.Publish(new RoomAnnouncement(priority, message));
    }

    private static bool ShouldIgnoreAnnouncement(string? message)
    {
        var text = (message ?? string.Empty).Trim();
        return string.Equals(text, "Table pleine", StringComparison.OrdinalIgnoreCase);
    }

    private void HandleStartConfigIntent(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        var message = payload.TryGetProperty("message", out var messageProp) &&
                      messageProp.ValueKind == JsonValueKind.String
            ? messageProp.GetString()
            : null;

        if (string.IsNullOrWhiteSpace(message))
        {
            var title = payload.TryGetProperty("title", out var titleProp) &&
                        titleProp.ValueKind == JsonValueKind.String
                ? titleProp.GetString()
                : null;
            var description = payload.TryGetProperty("description", out var descProp) &&
                              descProp.ValueKind == JsonValueKind.String
                ? descProp.GetString()
                : null;

            if (!string.IsNullOrWhiteSpace(title) && !string.IsNullOrWhiteSpace(description))
            {
                message = $"{title.Trim()}. {description.Trim()}";
            }
            else if (!string.IsNullOrWhiteSpace(title))
            {
                message = title;
            }
            else if (!string.IsNullOrWhiteSpace(description))
            {
                message = description;
            }
        }

        if (!string.IsNullOrWhiteSpace(message))
        {
            var normalized = message.Trim();
            _roomVm.Status = normalized;
            _history.Add(normalized);
        }
    }

    private void HandleFocusIntent(JsonElement payload)
    {
        if (!TryParseFocusIntent(payload, out var intent))
        {
            return;
        }
        _roomVm.EnqueueServerFocusIntent(intent);
    }

    private static bool TryParseFocusIntent(JsonElement payload, out ServerFocusIntent intent)
    {
        intent = default!;
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!payload.TryGetProperty("region", out var regionProp) ||
            regionProp.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        var region = MapRegion(regionProp.GetString());
        if (!region.HasValue)
        {
            return false;
        }

        var reason = payload.TryGetProperty("reason", out var reasonProp) &&
                     reasonProp.ValueKind == JsonValueKind.String
            ? reasonProp.GetString()
            : null;

        var priority = ServerFocusPriority.Default;
        if (payload.TryGetProperty("priority", out var priorityProp) &&
            priorityProp.ValueKind == JsonValueKind.String &&
            string.Equals(priorityProp.GetString(), "assertive", StringComparison.OrdinalIgnoreCase))
        {
            priority = ServerFocusPriority.Assertive;
        }

        intent = new ServerFocusIntent(region.Value, reason, priority);
        return true;
    }

    private static ServerFocusRegion? MapRegion(string? raw)
    {
        return (raw ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "game" => ServerFocusRegion.GameZone,
            "history" => ServerFocusRegion.History,
            "chat" => ServerFocusRegion.Chat,
            _ => null,
        };
    }

    private void HandleHistoryIntent(JsonElement payload)
    {
        if (!payload.TryGetProperty("entries", out var entries) ||
            entries.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (var entry in entries.EnumerateArray())
        {
            var line = entry.GetString();
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            _history.Add(line);
        }
    }
}
