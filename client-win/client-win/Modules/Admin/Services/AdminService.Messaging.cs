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

    public async Task<(int delivered, int delaySeconds, string scheduledAt)> ScheduleClientUpdateAsync(
        int delayMinutes,
        string? message = null,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminClientUpdateScheduleResponseDto>(
            WsMessageTypes.Admin.ClientUpdateSchedule,
            new
            {
                message,
                delayMinutes,
            },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Planification de mise a jour impossible.");
        }

        return (
            response.Payload.Delivered,
            response.Payload.DelaySeconds,
            response.Payload.ScheduledAt ?? string.Empty);
    }
}

internal sealed class AdminClientUpdateScheduleResponseDto
{
    public int Delivered { get; set; }
    public int DelaySeconds { get; set; }
    public string? ScheduledAt { get; set; }
}
