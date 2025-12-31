using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Network.Services;

public interface IWsTicketProvider
{
    Task<string?> GetTicketAsync(string scope, CancellationToken cancellationToken = default);
}

