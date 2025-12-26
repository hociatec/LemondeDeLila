using System;
using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Game.Room.Services;

public interface IRoomBotCommands : IDisposable
{
    event Action<string>? BotAdded;
    event Action<string>? BotRemoved;

    Task AddBotAsync(CancellationToken cancellationToken = default);
    Task RemoveLastBotAsync(CancellationToken cancellationToken = default);
}
