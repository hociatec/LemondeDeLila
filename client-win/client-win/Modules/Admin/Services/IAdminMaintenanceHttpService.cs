using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public interface IAdminMaintenanceHttpService
{
    Task<AdminMaintenanceCommandResponse> DaemonReloadAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceHealthResponse> GetHealthAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceUnitStatusResponse> GetBackendServiceStatusAsync(CancellationToken cancellationToken = default);
}
