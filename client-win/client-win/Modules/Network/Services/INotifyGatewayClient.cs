using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Network.Services;

public interface INotifyGatewayClient
{
    Task SendAsync(string type, object? payload = null, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> SendWithAckAsync(
        string type,
        object? payload,
        string successType,
        string errorType,
        CancellationToken cancellationToken = default);
    Task RequestInboxSnapshotAsync(CancellationToken cancellationToken = default);
}
