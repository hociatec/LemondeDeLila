using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<int> BroadcastAsync(string message, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminBroadcastResponseDto>(
            WsMessageTypes.Admin.Broadcast,
            new { message },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Envoi impossible.");
        }
        return response.Payload.Delivered;
    }

    public async Task<int> AnnounceClientUpdateAsync(string? message = null, string? version = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminClientUpdateAnnounceResponseDto>(
            WsMessageTypes.Admin.ClientUpdateAnnounce,
            new { message, version },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Annonce de mise à jour impossible.");
        }
        return response.Payload.Delivered;
    }
}

