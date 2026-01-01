using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminBugReportsListResponseDto> ListBugReportsAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminBugReportsListResponseDto>(
            WsMessageTypes.Admin.BugReportsList,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Chargement des rapports impossible.");
        }

        return res.Payload;
    }

    public async Task<AdminBugReportDto> CreateBugReportAsync(string subject, string content, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminBugReportResponseDto>(
            WsMessageTypes.Admin.BugReportsCreate,
            new { subject, content },
            token,
            cancellationToken).ConfigureAwait(false);

        var report = res.Payload?.Report;
        if (!res.Success || report == null)
        {
            throw new InvalidOperationException(res.Error ?? "Création du rapport impossible.");
        }

        return report;
    }

    public async Task<AdminBugReportDto> GetBugReportAsync(string id, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminBugReportResponseDto>(
            WsMessageTypes.Admin.BugReportsGet,
            new { id },
            token,
            cancellationToken).ConfigureAwait(false);

        var report = res.Payload?.Report;
        if (!res.Success || report == null)
        {
            throw new InvalidOperationException(res.Error ?? "Rapport introuvable.");
        }

        return report;
    }

    public async Task<AdminBugReportDto> UpdateBugReportAsync(string id, string? subject = null, string? content = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var payload = new System.Collections.Generic.Dictionary<string, object?>
        {
            ["id"] = id
        };
        if (subject != null)
        {
            payload["subject"] = subject;
        }
        if (content != null)
        {
            payload["content"] = content;
        }

        var res = await _ws.RequestAsync<AdminBugReportResponseDto>(
            WsMessageTypes.Admin.BugReportsUpdate,
            payload,
            token,
            cancellationToken).ConfigureAwait(false);

        var report = res.Payload?.Report;
        if (!res.Success || report == null)
        {
            throw new InvalidOperationException(res.Error ?? "Modification du rapport impossible.");
        }

        return report;
    }

    public async Task<AdminBugReportDto> UpdateBugReportStatusAsync(string id, string status, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminBugReportResponseDto>(
            WsMessageTypes.Admin.BugReportsUpdateStatus,
            new { id, status },
            token,
            cancellationToken).ConfigureAwait(false);

        var report = res.Payload?.Report;
        if (!res.Success || report == null)
        {
            throw new InvalidOperationException(res.Error ?? "Mise à jour du statut impossible.");
        }

        return report;
    }

    public async Task<bool> DeleteBugReportAsync(string id, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminBugReportDeleteResponseDto>(
            WsMessageTypes.Admin.BugReportsDelete,
            new { id },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Suppression du rapport impossible.");
        }

        return res.Payload.Removed;
    }
}
