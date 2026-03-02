using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Room.Services;

namespace client_win.Modules.Game.Room.Services;

public sealed class RoomClient : IAsyncDisposable
{
    private readonly RoomSession _session;
    private readonly RoomMessageRouter _router;
    private readonly RoomBotCommands _bots;
    private readonly RoomPrivacyCommands _privacy;
    private readonly RoomRoleCommands _role;
    private readonly RoomInfoCommands _info;
    private readonly RoomChatCommands _chat;
    private readonly IRoomAnnouncements _announcements;

    private readonly IDisposable _intentSubscription;

    public RoomClient(RoomSession session, IRoomAnnouncements announcements)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        _router = new RoomMessageRouter(_session);
        _bots = new RoomBotCommands(_session, _router);
        _privacy = new RoomPrivacyCommands(_session, _router);
        _role = new RoomRoleCommands(_session, _router);
        _info = new RoomInfoCommands(_session, _router);
        _chat = new RoomChatCommands(_session, _router);

        _session.RoomUpdated += payload => RoomUpdated?.Invoke(payload);
        _session.ConnectionStateChanged += state => ConnectionStateChanged?.Invoke(state);
        _session.ErrorReceived += msg => ErrorReceived?.Invoke(msg);
        _session.Left += reason => Left?.Invoke(reason);

        _bots.BotAdded += name =>
        {
            _announcements.BotJoined(name);
            BotJoined?.Invoke(name);
        };
        _bots.BotRemoved += name =>
        {
            _announcements.BotLeft(name);
            BotLeft?.Invoke(name);
        };

        _privacy.PrivacyChanged += isPrivate =>
        {
            _announcements.VisibilityChanged(isPrivate);
            PrivacyChanged?.Invoke(isPrivate);
        };

        _role.RoleChanged += isSpectator =>
        {
            _announcements.RoleChanged(isSpectator);
            RoleChanged?.Invoke(isSpectator);
        };

        _info.InfoReceived += message =>
        {
            _announcements.TableInfo(message);
            InfoReceived?.Invoke(message);
        };

        _chat.MessageReceived += msg => ChatMessageReceived?.Invoke(msg);
        _chat.HistoryReceived += list => ChatHistoryReceived?.Invoke(list);

        _intentSubscription = _router.Subscribe("room.intent", context => IntentReceived?.Invoke(context));
    }

    public RoomSession Session => _session;

    public RoomPayloadDto? CurrentPayload => _session.LastRoomState;

    public bool IsSpectator => _role.IsSpectator;

    public event Action<RoomPayloadDto>? RoomUpdated;
    public event Action<string>? ErrorReceived;
    public event Action<string>? Left;
    public event Action<WebSocketState>? ConnectionStateChanged;
    public event Action<RoomAnnouncement>? AnnouncementReceived;
    public event Action<string>? InfoReceived;
    public event Action<string>? BotJoined;
    public event Action<string>? BotRemoved;
    public event Action<bool>? PrivacyChanged;
    public event Action<bool>? RoleChanged;
    public event Action<RoomChatMessageDto>? ChatMessageReceived;
    public event Action<IReadOnlyList<RoomChatMessageDto>>? ChatHistoryReceived;
    public event Action<RoomMessageRouter.RoomMessageContext>? IntentReceived;

    public Task AddBotAsync(CancellationToken cancellationToken = default) => _bots.AddBotAsync(cancellationToken);
    public Task RemoveBotAsync(CancellationToken cancellationToken = default) => _bots.RemoveLastBotAsync(cancellationToken);
    public Task TogglePrivacyAsync(CancellationToken cancellationToken = default) => _privacy.TogglePrivacyAsync(cancellationToken);
    public Task ToggleRoleAsync(CancellationToken cancellationToken = default) => _role.ToggleRoleAsync(cancellationToken);
    public Task RequestInfoAsync(CancellationToken cancellationToken = default) => _info.RequestInfoAsync(cancellationToken);
    public Task RequestChatHistoryAsync(CancellationToken cancellationToken = default) => _chat.RequestHistoryAsync(cancellationToken);
    public Task SendChatMessageAsync(string message, CancellationToken cancellationToken = default)
    {
        var payload = new { message = (message ?? string.Empty).Trim() };
        return _session.SendCommandAsync("room.chat.send", payload, cancellationToken);
    }

    public void PublishAnnouncement(RoomAnnouncement announcement)
    {
        if (announcement == null)
        {
            return;
        }

        try
        {
            _announcements.Announced?.Invoke(announcement);
            AnnouncementReceived?.Invoke(announcement);
        }
        catch
        {
        }
    }


    public async ValueTask DisposeAsync()
    {
        _intentSubscription.Dispose();
        _router.Dispose();
        _bots.Dispose();
        _privacy.Dispose();
        _role.Dispose();
        _info.Dispose();
        _chat.Dispose();
        await _session.DisposeAsync().ConfigureAwait(false);
    }
}
