using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Vault.Models;

namespace client_win.Modules.Vault.Services;

public interface IVaultClient
{
    Task<IReadOnlyList<VaultSnapshotItem>> ListAsync(CancellationToken cancellationToken = default);
    Task<string> SaveAsync(int roomId, CancellationToken cancellationToken = default);
    Task<int> RestoreAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}

