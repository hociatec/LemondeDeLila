using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Models;
using client_win.Modules.Network;
using client_win.Modules.User.Services;
using client_win.Modules.Error;

namespace client_win.Modules.Game.Services;

public sealed class RoomDirectoryService : IRoomDirectoryService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;
    private readonly ErrorBus? _errors;

    public RoomDirectoryService(WsRequestClient ws, ISessionService session, ErrorBus? errors = null)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _errors = errors;
    }

    public async Task<IReadOnlyList<PublicRoomSummary>> ListPublicRoomsAsync(string? gameType, CancellationToken cancellationToken = default)
    {
        string? token = _session.CurrentUser?.Token;
        object payload = string.IsNullOrWhiteSpace(gameType)
            ? new { }
            : new { gameType };

        var response = await _ws.RequestAsync<RoomsPublicListedPayload>(
            "rooms.public.list",
            payload,
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            _errors?.Publish(new AppError(
                response.Error ?? "Chargement des tables impossible.",
                ErrorSeverity.Warning,
                context: "rooms.public.list"));
            return Array.Empty<PublicRoomSummary>();
        }

        var rooms = new List<PublicRoomSummary>();
        if (response.Payload.Groups != null && response.Payload.Groups.Count > 0)
        {
            foreach (var group in response.Payload.Groups)
            {
                if (group?.Rooms == null) continue;
                rooms.AddRange(group.Rooms.Select(MapSummary).Where(r => r != null)!);
            }
        }
        else if (response.Payload.Items != null)
        {
            rooms.AddRange(response.Payload.Items.Select(MapSummary).Where(r => r != null)!);
        }

        return rooms
            .Where(r => r != null)
            .OrderBy(r => r!.GameType)
            .ThenBy(r => r!.Name)
            .ToList()!;
    }

    public async Task<JoinedRoom?> JoinPublicRoomAsync(int roomId, CancellationToken cancellationToken = default)
    {
        if (roomId <= 0)
        {
            return null;
        }

        string? token = _session.CurrentUser?.Token;
        var response = await _ws.RequestAsync<RoomsPublicJoinedPayload>(
            "rooms.public.join",
            new { roomId },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            _errors?.Publish(new AppError(
                response.Error ?? "Impossible de rejoindre la table.",
                ErrorSeverity.Warning,
                context: "rooms.public.join"));
            return null;
        }

        var room = response.Payload.Room;
        string gameType = room?.GameType ?? string.Empty;
        string name = room?.Name ?? string.Empty;
        int id = response.Payload.RoomId > 0 ? response.Payload.RoomId : room?.Id ?? roomId;
        return new JoinedRoom(id, gameType, name);
    }

    public async Task<JoinedRoom?> SpectatePublicRoomAsync(int roomId, CancellationToken cancellationToken = default)
    {
        if (roomId <= 0)
        {
            return null;
        }

        string? token = _session.CurrentUser?.Token;
        var response = await _ws.RequestAsync<RoomsPublicJoinedPayload>(
            "rooms.public.spectate",
            new { roomId },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            _errors?.Publish(new AppError(
                response.Error ?? "Impossible d'ouvrir la table en spectateur.",
                ErrorSeverity.Warning,
                context: "rooms.public.spectate"));
            return null;
        }

        var room = response.Payload.Room;
        string gameType = room?.GameType ?? string.Empty;
        string name = room?.Name ?? string.Empty;
        int id = response.Payload.RoomId > 0 ? response.Payload.RoomId : room?.Id ?? roomId;
        return new JoinedRoom(id, gameType, name);
    }

    private static PublicRoomSummary? MapSummary(PublicRoomSummaryDto? dto)
    {
        if (dto == null || dto.Id <= 0)
        {
            return null;
        }
        return new PublicRoomSummary
        {
            Id = dto.Id,
            Name = dto.Name ?? string.Empty,
            GameType = dto.GameType ?? string.Empty,
            Status = dto.Status ?? string.Empty,
            MaxPlayers = dto.MaxPlayers,
            PlayersCount = dto.PlayersCount,
            BotsCount = dto.BotsCount,
            OwnerUsername = dto.Owner?.Username ?? dto.OwnerUsername ?? string.Empty
        };
    }

    private sealed class RoomsPublicListedPayload
    {
        public List<PublicRoomSummaryDto>? Items { get; set; }
        public List<PublicRoomGroupDto>? Groups { get; set; }
    }

    private sealed class RoomsPublicJoinedPayload
    {
        public int RoomId { get; set; }
        public RoomDto? Room { get; set; }
    }

    private sealed class PublicRoomGroupDto
    {
        public string? GameType { get; set; }
        public List<PublicRoomSummaryDto>? Rooms { get; set; }
    }

    private sealed class PublicRoomSummaryDto
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? GameType { get; set; }
        public string? Status { get; set; }
        public int MaxPlayers { get; set; }
        public int PlayersCount { get; set; }
        public int BotsCount { get; set; }
        public OwnerDto? Owner { get; set; }
        public string? OwnerUsername { get; set; }
    }

    private sealed class OwnerDto
    {
        public int Id { get; set; }
        public string? Username { get; set; }
    }

    private sealed class RoomDto
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? GameType { get; set; }
    }
}
