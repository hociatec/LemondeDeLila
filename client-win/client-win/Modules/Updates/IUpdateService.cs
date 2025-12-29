using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Updates;

public interface IUpdateService
{
    bool IsSupported { get; }
    string CurrentVersion { get; }

    Task<UpdateCheckResult> CheckAsync(CancellationToken cancellationToken);
    Task<UpdateInstallResult> InstallAsync(CancellationToken cancellationToken);
}

