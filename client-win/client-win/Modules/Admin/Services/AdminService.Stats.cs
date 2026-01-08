using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task ResetAllStoryBookAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<object>(
            WsMessageTypes.Admin.StatsResetAll,
            payload: new { },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Réinitialisation du livre des contes impossible.");
        }
    }
}

