using System;
using System.Collections.ObjectModel;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Presence.Models;

namespace client_win.Modules.Presence.Services;

public interface IPresenceMonitor
{
    ObservableCollection<PresencePlayer> Players { get; }
    string Status { get; }
    event Action? PlayersChanged;

    int? CurrentRoomId { get; }
    string? CurrentRoomName { get; }

    Task StartAsync(CancellationToken cancellationToken = default);
    Task StopAsync(CancellationToken cancellationToken = default);

    Task SetHomeAsync(CancellationToken cancellationToken = default);
    Task SetTableAsync(int roomId, string? roomName, CancellationToken cancellationToken = default);
}

