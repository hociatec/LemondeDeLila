using System;

namespace client_win.Modules.Presence.Models;

public sealed class PresencePlayer
{
    public PresencePlayer(int id, string username, string activity, int? currentRoomId, string? currentRoomName)
    {
        Id = id;
        Username = username ?? string.Empty;
        Activity = activity ?? "home";
        CurrentRoomId = currentRoomId;
        CurrentRoomName = currentRoomName;
    }

    public int Id { get; }
    public string Username { get; }
    public string Activity { get; }
    public int? CurrentRoomId { get; }
    public string? CurrentRoomName { get; }

    public override string ToString() => Username;
}

