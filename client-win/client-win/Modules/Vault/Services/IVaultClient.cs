using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Vault.Models;

namespace client_win.Modules.Vault.Services;

public interface IVaultClient
{
    event EventHandler? SnapshotsChanged;

    Task<IReadOnlyList<VaultSnapshotItem>> ListAsync(CancellationToken cancellationToken = default);
    Task<string> SaveAsync(int roomId, string? snapshotId = null, CancellationToken cancellationToken = default);
    Task<int> RestoreAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> AbandonAsync(int roomId, CancellationToken cancellationToken = default);
}
