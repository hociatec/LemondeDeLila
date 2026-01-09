using System;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.RoomDirectory.Services;

public interface IRoomDirectoryClient
{
    Task<string> InviteSendAsync(int roomId, int userId, CancellationToken cancellationToken = default);
    Task<RoomInviteRespondResult> InviteRespondAsync(string invitationId, bool accept, CancellationToken cancellationToken = default);

    Task<PublicRoomsListedResult> PublicListAsync(string? gameType = null, CancellationToken cancellationToken = default);
    Task<PublicRoomsListedResult> PublicSubscribeAsync(string? gameType = null, CancellationToken cancellationToken = default);
    Task<bool> PublicUnsubscribeAsync(CancellationToken cancellationToken = default);
    IDisposable OnPublicRefresh(Action onRefresh);
    IDisposable OnTransportConnected(Action onConnected);
}

public sealed class RoomInviteRespondResult
{
    public RoomInviteRespondResult(bool accepted, bool expired, int? roomId, bool spectator)
    {
        Accepted = accepted;
        Expired = expired;
        RoomId = roomId;
        Spectator = spectator;
    }

    public bool Accepted { get; }
    public bool Expired { get; }
    public int? RoomId { get; }
    public bool Spectator { get; }
}

public sealed class PublicRoomsListedResult
{
    public PublicRoomsListedResult(PublicRoomListItem[] items)
    {
        Items = items ?? Array.Empty<PublicRoomListItem>();
    }

    public PublicRoomListItem[] Items { get; }
}

public sealed class PublicRoomListItem
{
    public PublicRoomListItem(int id, string name, string gameType, string status, bool started, bool spectatorOnly, int maxPlayers, int playersCount, int botsCount, string? ownerUsername)
    {
        Id = id;
        Name = name ?? string.Empty;
        GameType = gameType ?? string.Empty;
        Status = status ?? string.Empty;
        Started = started;
        SpectatorOnly = spectatorOnly;
        MaxPlayers = maxPlayers;
        PlayersCount = playersCount;
        BotsCount = botsCount;
        OwnerUsername = ownerUsername;
    }

    public int Id { get; }
    public string Name { get; }
    public string GameType { get; }
    public string Status { get; }
    public bool Started { get; }
    public bool SpectatorOnly { get; }
    public int MaxPlayers { get; }
    public int PlayersCount { get; }
    public int BotsCount { get; }
    public string? OwnerUsername { get; }

    public string Slots => $"{PlayersCount + BotsCount}/{MaxPlayers}";

    // Libellé destiné aux lecteurs d'écran : mettre en avant le jeu, puis les infos utiles.
    public string A11yLabel
    {
        get
        {
            var game = NormalizeForSpeech(GameType);
            if (string.IsNullOrWhiteSpace(game))
            {
                game = NormalizeForSpeech(Name);
            }
            if (string.IsNullOrWhiteSpace(game))
            {
                game = $"Table {Id}";
            }

            var owner = NormalizeForSpeech(OwnerUsername);
            var status = NormalizeForSpeech(Status);
            var parts = new System.Collections.Generic.List<string>(capacity: 3);
            if (!string.IsNullOrWhiteSpace(owner))
            {
                parts.Add(owner);
            }
            if (SpectatorOnly)
            {
                parts.Add("spectateur");
            }
            if (!string.IsNullOrWhiteSpace(status))
            {
                parts.Add(status);
            }
            parts.Add(Slots);

            return parts.Count == 0 ? game : $"{game} ({string.Join(", ", parts)})";
        }
    }

    private static string NormalizeForSpeech(string? value)
    {
        var s = (value ?? string.Empty).Trim();
        if (s.Length == 0)
        {
            return string.Empty;
        }

        // Evite que NVDA épelle des slugs: "panier-express" -> "panier express"
        s = s.Replace('-', ' ').Replace('_', ' ');
        while (s.Contains("  ", StringComparison.Ordinal))
        {
            s = s.Replace("  ", " ", StringComparison.Ordinal);
        }
        return s.Trim();
    }

    public override string ToString()
    {
        var owner = string.IsNullOrWhiteSpace(OwnerUsername) ? "—" : OwnerUsername;
        var title = string.IsNullOrWhiteSpace(Name) ? $"Table #{Id}" : Name;
        var game = string.IsNullOrWhiteSpace(GameType) ? "unknown" : GameType;
        return $"{title} • {game} • {Slots} • {owner}";
    }
}
