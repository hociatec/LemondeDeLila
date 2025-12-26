using System;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public interface IRoomPrivacyCommands : IDisposable
{
    event Action<bool>? PrivacyChanged;

    Task TogglePrivacyAsync(CancellationToken cancellationToken = default);
}
