using System;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Network;
using client_win.Modules.User.Services;

namespace client_win.Modules.Game.RoomDirectory.Services;

public sealed class RoomDirectoryClient : IRoomDirectoryClient
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;

    public RoomDirectoryClient(WsRequestClient ws, ISessionService session)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
    }

    public async Task<string> InviteSendAsync(int roomId, int userId, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await _ws.RequestAsync<InviteSendPayload>(
            WsMessageTypes.Rooms.InviteSend,
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

        if (!string.IsNullOrWhiteSpace(res.Payload?.InvitationId))
        {
            return "Invitation envoyée.";
        }

        return "Invitation traitée.";
    }

    public async Task<RoomInviteRespondResult> InviteRespondAsync(string invitationId, bool accept, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await _ws.RequestAsync<InviteRespondPayload>(
            WsMessageTypes.Rooms.InviteRespond,
            new { invitationId, accept },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success)
        {
            return new RoomInviteRespondResult(accepted: false, expired: false, roomId: null, spectator: false);
        }

        if (string.Equals(res.Type, "rooms.invite.accepted", StringComparison.OrdinalIgnoreCase))
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
}
