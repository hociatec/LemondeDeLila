using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminLogsDownloadResponseDto> DownloadLogsAsync(int lines = 200, string? filter = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminLogsDownloadResponseDto>(
            WsMessageTypes.Admin.LogsDownload,
            new { lines, filter },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Téléchargement des logs impossible.");
        }
        return response.Payload;
    }
}

