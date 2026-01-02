using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using client_win.Core.Network;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task DeployBackendAsync()
    {
        if (IsBusy)
        {
            return;
        }

        var confirmed = await _dialogs.Confirm(
            "Maintenance",
            "Déclencher le déploiement backend (git pull + build + migrations + restart) ?\n\n" +
            "Note: le redémarrage coupe momentanément la connexion, le client va retry automatiquement.",
            okText: "Déployer",
            cancelText: "Annuler").ConfigureAwait(true);

        if (confirmed != true)
        {
            return;
        }

        AdminMaintenanceUnitStatusResponse? lastDeployStatus = null;
        string? lastLogs = null;

        try
        {
            IsBusy = true;
            Status = "Déploiement: démarrage…";
            Details = string.Empty;

            await _maintenance.StartDeployAsync().ConfigureAwait(true);

            var deadline = DateTimeOffset.UtcNow.AddMinutes(4);
            var attempt = 0;

            while (DateTimeOffset.UtcNow < deadline)
            {
                attempt++;
                try
                {
                    lastDeployStatus = await _maintenance.GetDeployStatusAsync().ConfigureAwait(true);
                    var logs = await _maintenance.GetDeployLogsAsync(200).ConfigureAwait(true);
                    lastLogs = logs.Logs;

                    Status = FormatDeployStatus(lastDeployStatus);
                    Details = BuildDeployDetails(lastDeployStatus, lastLogs);

                    if (IsDeployFinished(lastDeployStatus))
                    {
                        break;
                    }

                    await Task.Delay(TimeSpan.FromSeconds(2)).ConfigureAwait(true);
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
                {
                    Status = "Déploiement: attente du serveur (restart)…";
                    await Task.Delay(RetryStrategy.CalculateDelay(attempt, baseDelayMs: 750, maxDelayMs: 5000))
                        .ConfigureAwait(true);
                }
            }

            if (lastDeployStatus == null)
            {
                await _dialogs.ShowError("Maintenance", "Impossible de récupérer le status du déploiement.").ConfigureAwait(true);
                return;
            }

            if (!IsDeployFinished(lastDeployStatus))
            {
                await _dialogs.ShowError(
                        "Maintenance",
                        "Timeout: le déploiement n'a pas terminé à temps.\n\n" + FormatDeployStatus(lastDeployStatus))
                    .ConfigureAwait(true);
                return;
            }

            var backendStatus = await TryGetBackendServiceStatusAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo(
                    "Maintenance",
                    "Déploiement terminé.\n\n" +
                    FormatDeployStatus(lastDeployStatus) +
                    (backendStatus == null ? string.Empty : "\n\nBackend: " + FormatDeployStatus(backendStatus)))
                .ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task<AdminMaintenanceUnitStatusResponse?> TryGetBackendServiceStatusAsync()
    {
        try
        {
            return await _maintenance.GetBackendServiceStatusAsync().ConfigureAwait(true);
        }
        catch
        {
            return null;
        }
    }

    private static bool IsDeployFinished(AdminMaintenanceUnitStatusResponse status)
    {
        var active = (status.ActiveState ?? string.Empty).Trim().ToLowerInvariant();
        var result = (status.Result ?? string.Empty).Trim().ToLowerInvariant();

        if (active == "failed")
        {
            return true;
        }

        // Typical oneshot completion: inactive + success/failed.
        return active == "inactive" && (result == "success" || result == "failed");
    }

    private static string FormatDeployStatus(AdminMaintenanceUnitStatusResponse status)
    {
        var unit = (status.Unit ?? "unknown").Trim();
        var active = (status.ActiveState ?? "?").Trim();
        var sub = (status.SubState ?? "?").Trim();
        var result = (status.Result ?? "?").Trim();
        var code = (status.ExecMainCode ?? "?").Trim();
        var exitStatus = (status.ExecMainStatus ?? "?").Trim();

        return $"{unit}: {active}/{sub} (result={result}, code={code}, status={exitStatus})";
    }

    private static string BuildDeployDetails(AdminMaintenanceUnitStatusResponse status, string? logs)
    {
        var tail = TailLines(logs, 40);
        if (string.IsNullOrWhiteSpace(tail))
        {
            return FormatDeployStatus(status);
        }
        return FormatDeployStatus(status) + "\n\n" + tail;
    }

    private static string TailLines(string? text, int maxLines)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }
        var lines = text
            .Split(new[] { "\r\n", "\n" }, StringSplitOptions.None)
            .Select(l => l.TrimEnd())
            .ToArray();
        if (lines.Length <= maxLines)
        {
            return string.Join("\n", lines).Trim();
        }
        return string.Join("\n", lines.Skip(lines.Length - maxLines)).Trim();
    }
}

