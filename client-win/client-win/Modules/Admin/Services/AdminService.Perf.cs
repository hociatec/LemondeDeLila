using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminPerfSnapshotDto> GetPerfSnapshotAsync(int? windowSeconds = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminPerfSnapshotDto>(
            WsMessageTypes.Admin.PerfSnapshot,
            payload: new { windowSeconds },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement diagnostics impossible.");
        }
        return response.Payload;
    }
}

