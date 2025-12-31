using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;
using System;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminRoomsCleanupResponseDto> CleanupRoomsAsync(
        bool includePrivate = false,
        bool includeStarted = false,
        int? olderThanMinutes = null,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminRoomsCleanupResponseDto>(
            WsMessageTypes.Admin.RoomsCleanup,
            new
            {
                confirm = true,
                includePrivate,
                includeStarted,
                olderThanMinutes
            },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Nettoyage des rooms impossible.");
        }

        return res.Payload;
    }
}
