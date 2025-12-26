using System;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public interface IRoomPrivacyCommands : IDisposable
{
    event Action<bool>? PrivacyChanged;
    event Action<string>? ErrorReceived;

    Task TogglePrivacyAsync(CancellationToken cancellationToken = default);
}

