using System;

namespace client_win.Modules.Presence.Models;

public sealed class PresencePlayer
{
    public PresencePlayer(
        int id,
        string username,
        string activity,
        int? currentRoomId,
        string? currentRoomName,
        string? availability = null,
        string? location = null)
    {
        Id = id;
        Username = username ?? string.Empty;
        Activity = activity ?? "home";
        CurrentRoomId = currentRoomId;
        CurrentRoomName = currentRoomName;
        Availability = availability ?? string.Empty;
        Location = location ?? string.Empty;
    }

    public int Id { get; }
    public string Username { get; }
    public string Activity { get; }
    public int? CurrentRoomId { get; }
    public string? CurrentRoomName { get; }
    public string Availability { get; }
    public string Location { get; }

    public override string ToString() => Username;
}
