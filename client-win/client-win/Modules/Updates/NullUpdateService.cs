using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Updates;

public sealed class NullUpdateService : IUpdateService
{
    public static readonly NullUpdateService Instance = new();

    private NullUpdateService()
    {
    }

    public bool IsSupported => false;
    public string CurrentVersion => "inconnue";

    public Task<UpdateCheckResult> CheckAsync(CancellationToken cancellationToken) =>
        Task.FromResult(new UpdateCheckResult(false, null, "Mises à jour indisponibles."));

    public Task<UpdateInstallResult> InstallAsync(CancellationToken cancellationToken) =>
        Task.FromResult(new UpdateInstallResult(false, false, "Mises à jour indisponibles."));
}

