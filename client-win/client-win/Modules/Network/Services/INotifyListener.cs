using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Network.Services;

public interface INotifyListener
{
    Task StartAsync(CancellationToken cancellationToken = default);
    Task StopAsync(CancellationToken cancellationToken = default);
}

