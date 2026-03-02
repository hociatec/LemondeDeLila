using System;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Network;
using client_win.Modules.User.Services;

namespace client_win.Modules.Game.Room.Lobby.Services;

public sealed class RoomLobbyClient : IRoomLobbyClient
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;
    private readonly ISoundService _sounds;
    private readonly Modules.Network.PersistentWsClient _transport;

    public RoomLobbyClient(WsRequestClient ws, ISessionService session, ISoundService sounds, Modules.Network.PersistentWsClient transport)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _transport = transport ?? throw new ArgumentNullException(nameof(transport));
    }

    public async Task<string> InviteSendAsync(int roomId, int userId, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await RequestWithLegacyFallbackAsync<InviteSendPayload>(
            WsMessageTypes.Rooms.InviteSend,
            WsMessageTypes.Rooms.LegacyInviteSend,
            new { roomId, userId },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success)
        {
            return res.Error ?? "Invitation impossible.";
        }

        if (res.Payload?.AlreadyInRoom == true)
        {
            return "Le joueur est déjà dans la table.";
        }

        if (res.Payload?.Pending == true)
        {
            _sounds.Play(SoundId.InvitationSent);
            return "Invitation déjà envoyée (en attente).";
        }

        if (!string.IsNullOrWhiteSpace(res.Payload?.InvitationId))
        {
            _sounds.Play(SoundId.InvitationSent);
            return "Invitation envoyée.";
        }

        return "Invitation traitée.";
    }

    public async Task<InvitePresenceListResult> InvitePresenceListAsync(int roomId, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await RequestWithLegacyFallbackAsync<InvitePresenceListedPayload>(
            WsMessageTypes.Rooms.InvitePresenceList,
            WsMessageTypes.Rooms.LegacyInvitePresenceList,
            new { roomId },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success)
        {
            throw new InvalidOperationException(res.Error ?? "Liste des présences impossible.");
        }

        var players = (res.Payload?.Players ?? Array.Empty<InvitePresenceListedPlayer>())
            .Where(p => p != null && p.Id > 0 && !string.IsNullOrWhiteSpace(p.Username))
            .Select(p => new InvitePresenceListItem(
                id: p.Id,
                username: p.Username?.Trim() ?? string.Empty,
                availability: string.IsNullOrWhiteSpace(p.Availability) ? null : p.Availability.Trim(),
                location: string.IsNullOrWhiteSpace(p.Location) ? null : p.Location.Trim(),
                pendingInvite: p.PendingInvite))
            .OrderBy(p => p.Username, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return new InvitePresenceListResult(players);
    }

    public async Task<RoomInviteRespondResult> InviteRespondAsync(string invitationId, bool accept, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await RequestWithLegacyFallbackAsync<InviteRespondPayload>(
            WsMessageTypes.Rooms.InviteRespond,
            WsMessageTypes.Rooms.LegacyInviteRespond,
            new { invitationId, accept },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success)
        {
            return new RoomInviteRespondResult(accepted: false, expired: false, roomId: null, spectator: false);
        }

        if (string.Equals(res.Type, "rooms.invite.accepted", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(res.Type, "room.lobby.invite.accepted", StringComparison.OrdinalIgnoreCase))
        {
            return new RoomInviteRespondResult(
                accepted: true,
                expired: false,
                roomId: res.Payload?.RoomId,
                spectator: res.Payload?.Spectator == true);
        }

        // rooms.invite.responded
        return new RoomInviteRespondResult(
            accepted: res.Payload?.Accepted == true,
            expired: res.Payload?.Expired == true,
            roomId: res.Payload?.RoomId,
            spectator: false);
    }

    private sealed class InviteSendPayload
    {
        [JsonPropertyName("invitationId")]
        public string? InvitationId { get; set; }

        [JsonPropertyName("alreadyInRoom")]
        public bool AlreadyInRoom { get; set; }

        [JsonPropertyName("pending")]
        public bool Pending { get; set; }
    }

    private sealed class InvitePresenceListedPayload
    {
        [JsonPropertyName("players")]
        public InvitePresenceListedPlayer[]? Players { get; set; }
    }

    private sealed class InvitePresenceListedPlayer
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("username")]
        public string? Username { get; set; }

        [JsonPropertyName("availability")]
        public string? Availability { get; set; }

        [JsonPropertyName("location")]
        public string? Location { get; set; }

        [JsonPropertyName("pendingInvite")]
        public bool PendingInvite { get; set; }
    }

    private sealed class InviteRespondPayload
    {
        [JsonPropertyName("accepted")]
        public bool Accepted { get; set; }

        [JsonPropertyName("expired")]
        public bool Expired { get; set; }

        [JsonPropertyName("roomId")]
        public int? RoomId { get; set; }

        [JsonPropertyName("spectator")]
        public bool Spectator { get; set; }
    }

    public async Task<PublicRoomsListedResult> PublicListAsync(string? gameType = null, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await RequestWithLegacyFallbackAsync<PublicRoomsListedPayload>(
            WsMessageTypes.Rooms.PublicList,
            WsMessageTypes.Rooms.LegacyPublicList,
            string.IsNullOrWhiteSpace(gameType) ? new { } : new { gameType },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success)
        {
            throw new InvalidOperationException(res.Error ?? "Liste des tables publiques impossible.");
        }
        if (res.Payload?.Items == null)
        {
            return new PublicRoomsListedResult(Array.Empty<PublicRoomListItem>());
        }

        return new PublicRoomsListedResult(res.Payload.Items
            .Select(i => new PublicRoomListItem(
                id: i.Id,
                name: i.Name ?? string.Empty,
                gameType: i.GameType ?? string.Empty,
                status: i.Status ?? string.Empty,
                started: i.Started,
                spectatorOnly: i.SpectatorOnly,
                maxPlayers: i.MaxPlayers,
                playersCount: i.PlayersCount,
                botsCount: i.BotsCount,
                ownerUsername: i.Owner?.Username))
            .ToArray());
    }

    public async Task<PublicRoomsListedResult> PublicSubscribeAsync(string? gameType = null, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await RequestWithLegacyFallbackAsync<PublicRoomsListedPayload>(
            WsMessageTypes.Rooms.PublicSubscribe,
            WsMessageTypes.Rooms.LegacyPublicSubscribe,
            string.IsNullOrWhiteSpace(gameType) ? new { } : new { gameType },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success)
        {
            throw new InvalidOperationException(res.Error ?? "Abonnement aux tables publiques impossible.");
        }
        if (res.Payload?.Items == null)
        {
            return new PublicRoomsListedResult(Array.Empty<PublicRoomListItem>());
        }

        return new PublicRoomsListedResult(res.Payload.Items
            .Select(i => new PublicRoomListItem(
                id: i.Id,
                name: i.Name ?? string.Empty,
                gameType: i.GameType ?? string.Empty,
                status: i.Status ?? string.Empty,
                started: i.Started,
                spectatorOnly: i.SpectatorOnly,
                maxPlayers: i.MaxPlayers,
                playersCount: i.PlayersCount,
                botsCount: i.BotsCount,
                ownerUsername: i.Owner?.Username))
            .ToArray());
    }

    public async Task<bool> PublicUnsubscribeAsync(CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await RequestWithLegacyFallbackAsync<OkPayload>(
            WsMessageTypes.Rooms.PublicUnsubscribe,
            WsMessageTypes.Rooms.LegacyPublicUnsubscribe,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);
        return res.Success && res.Payload?.Ok == true;
    }

    public IDisposable OnPublicRefresh(Action onRefresh)
    {
        if (onRefresh == null) throw new ArgumentNullException(nameof(onRefresh));
        void Handler(string raw)
        {
            try
            {
                var parsed = System.Text.Json.JsonDocument.Parse(raw);
                var root = parsed.RootElement;
                if (!root.TryGetProperty("type", out var typeProp) || typeProp.ValueKind != System.Text.Json.JsonValueKind.String)
                {
                    return;
                }
                var type = typeProp.GetString() ?? string.Empty;
                if (!string.Equals(type, "rooms.public.refresh", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(type, "room.lobby.refresh", StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }
                onRefresh();
            }
            catch
            {
                // ignore
            }
        }

        _transport.UnmatchedMessageReceived += Handler;
        return new Unsubscriber(() => _transport.UnmatchedMessageReceived -= Handler);
    }

    public IDisposable OnTransportConnected(Action onConnected)
    {
        if (onConnected == null) throw new ArgumentNullException(nameof(onConnected));
        void Handler()
        {
            try
            {
                onConnected();
            }
            catch
            {
                // ignore
            }
        }

        _transport.Connected += Handler;
        return new Unsubscriber(() => _transport.Connected -= Handler);
    }

    private async Task<WsResponse<TPayload>> RequestWithLegacyFallbackAsync<TPayload>(
        string lobbyType,
        string legacyType,
        object payload,
        string? token,
        CancellationToken cancellationToken)
    {
        var primary = await _ws.RequestAsync<TPayload>(
                lobbyType,
                payload,
                token,
                cancellationToken)
            .ConfigureAwait(false);

        if (primary.Success || !IsUnknownTypeError(primary.Error))
        {
            return primary;
        }

        return await _ws.RequestAsync<TPayload>(
                legacyType,
                payload,
                token,
                cancellationToken)
            .ConfigureAwait(false);
    }

    private static bool IsUnknownTypeError(string? message)
    {
        var msg = (message ?? string.Empty).Trim();
        if (msg.Length == 0)
        {
            return false;
        }

        return msg.Contains("Type de message inconnu", StringComparison.OrdinalIgnoreCase) ||
               msg.Contains("message inconnu", StringComparison.OrdinalIgnoreCase);
    }

    private sealed class PublicRoomsListedPayload
    {
        [JsonPropertyName("items")]
        public PublicRoomListItemPayload[]? Items { get; set; }
    }

    private sealed class PublicRoomListItemPayload
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("gameType")]
        public string? GameType { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("started")]
        public bool Started { get; set; }

        [JsonPropertyName("spectatorOnly")]
        public bool SpectatorOnly { get; set; }

        [JsonPropertyName("maxPlayers")]
        public int MaxPlayers { get; set; }

        [JsonPropertyName("playersCount")]
        public int PlayersCount { get; set; }

        [JsonPropertyName("botsCount")]
        public int BotsCount { get; set; }

        [JsonPropertyName("owner")]
        public OwnerPayload? Owner { get; set; }
    }

    private sealed class OwnerPayload
    {
        [JsonPropertyName("username")]
        public string? Username { get; set; }
    }

    private sealed class OkPayload
    {
        [JsonPropertyName("ok")]
        public bool Ok { get; set; }
    }

    private sealed class Unsubscriber : IDisposable
    {
        private readonly Action _dispose;
        private int _disposed;

        public Unsubscriber(Action dispose)
        {
            _dispose = dispose ?? throw new ArgumentNullException(nameof(dispose));
        }

        public void Dispose()
        {
            if (System.Threading.Interlocked.Exchange(ref _disposed, 1) == 1) return;
            _dispose();
        }
    }
}
