using System;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public interface IRoomRoleCommands : IDisposable
{
    event Action<bool>? RoleChanged;

    bool IsSpectator { get; }
    Task ToggleRoleAsync(CancellationToken cancellationToken = default);
}
