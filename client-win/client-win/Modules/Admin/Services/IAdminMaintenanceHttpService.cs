using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public interface IAdminMaintenanceHttpService
{
    Task<AdminMaintenanceStartDeployResponse> StartDeployAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceCommandResponse> DryRunBuildAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceCommandResponse> RunMigrationsAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceRestartResponse> RestartBackendAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceCommandResponse> DaemonReloadAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceHealthResponse> GetHealthAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceUnitStatusResponse> GetDeployStatusAsync(CancellationToken cancellationToken = default);
    Task<AdminMaintenanceLogsResponse> GetDeployLogsAsync(int tail = 200, CancellationToken cancellationToken = default);
    Task<AdminMaintenanceUnitStatusResponse> GetBackendServiceStatusAsync(CancellationToken cancellationToken = default);
}
