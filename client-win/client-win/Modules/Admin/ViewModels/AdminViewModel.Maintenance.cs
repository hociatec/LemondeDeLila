using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using client_win.Core.Network;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private bool HasMaintenanceTokenConfigured()
    {
        return !string.IsNullOrWhiteSpace(_config.AdminMaintenanceToken) || _maintenanceTokenStore.HasToken();
    }

    private static bool LooksLikeTokenError(Exception ex)
    {
        var msg = (ex.Message ?? string.Empty).Trim();
        if (msg.Length == 0) return false;
        return msg.Contains("Token de maintenance", StringComparison.OrdinalIgnoreCase) ||
               msg.Contains("Maintenance non configurée", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> EnsureMaintenanceTokenAsync(bool promptIfMissing = true)
    {
        if (HasMaintenanceTokenConfigured())
        {
            return true;
        }

        if (!promptIfMissing)
        {
            return false;
        }

        await _dialogs.ShowInfo(
                "Maintenance",
                "Le serveur demande un token de maintenance (barrière supplémentaire pour déployer).\n\n" +
                "Saisissez-le une fois : il sera mémorisé (chiffré) pour ce compte Windows.")
            .ConfigureAwait(true);

        var token = await _secretPrompts
            .PromptSecretAsync("Maintenance", "Token de maintenance")
            .ConfigureAwait(true);

        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        try
        {
            _maintenanceTokenStore.Save(token);
            return true;
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Maintenance", "Impossible d'enregistrer le token: " + ex.Message).ConfigureAwait(true);
            return false;
        }
    }

    private async Task<bool> EnsureMaintenanceTokenOrUpdateAsync(Exception ex)
    {
        if (!LooksLikeTokenError(ex))
        {
            return false;
        }

        // Token manquant: demander une saisie.
        if ((ex.Message ?? string.Empty).Contains("manquant", StringComparison.OrdinalIgnoreCase))
        {
            return await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true);
        }

        // Token invalide: proposer de le remplacer.
        var confirmed = await _dialogs
            .Confirm(
                "Maintenance",
                "Le token de maintenance est invalide.\n\nVoulez-vous le ressaisir ?",
                okText: "Ressaisir",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirmed != true)
        {
            return false;
        }

        _maintenanceTokenStore.Clear();
        return await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true);
    }

    private void BuildMaintenance()
    {
        _page = AdminPage.Maintenance;
        Title = "Maintenance";
        Details = string.Empty;
        Items.Clear();
        Items.Add(new AdminMenuItem("Rafraîchir (status + logs)", tag: "maintenance.refresh"));
        Items.Add(new AdminMenuItem("Logs du déploiement", tag: "maintenance.logs"));
        Items.Add(new AdminMenuItem("Status service backend", tag: "maintenance.service.status"));
        SelectedItem = Items.FirstOrDefault();

        PreferDetailsFocus = true;
        IsTextInputVisible = false;
        TextInputLabel = string.Empty;
        TextInput = string.Empty;
        IsSecondaryInputVisible = false;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        Status = "Entrée : exécuter l'action sélectionnée. Échap : retour.";

        _ = RefreshMaintenanceAsync();
    }

    private async Task RefreshMaintenanceAsync()
    {
        if (IsBusy)
        {
            return;
        }

        try
        {
            if (!await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true))
            {
                Status = "Maintenance: token requis";
                return;
            }

            IsBusy = true;
            Status = "Maintenance: chargement…";

            var backend = await _maintenance.GetBackendServiceStatusAsync().ConfigureAwait(true);
            var deploy = await _maintenance.GetDeployStatusAsync().ConfigureAwait(true);
            var logs = await _maintenance.GetDeployLogsAsync(200).ConfigureAwait(true);

            Details =
                "Backend:\n" + FormatDeployStatus(backend) +
                "\n\nDéploiement:\n" + FormatDeployStatus(deploy) +
                "\n\nLogs (tail):\n" + TailLines(logs.Logs, 80);

            Status = "Maintenance: OK";
        }
        catch (Exception ex)
        {
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await RefreshMaintenanceAsync().ConfigureAwait(true);
                return;
            }
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task RefreshMaintenanceLogsAsync()
    {
        if (IsBusy)
        {
            return;
        }

        try
        {
            if (!await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true))
            {
                Status = "Maintenance: token requis";
                return;
            }

            IsBusy = true;
            Status = "Maintenance: logs…";

            var logs = await _maintenance.GetDeployLogsAsync(500).ConfigureAwait(true);
            Details = TailLines(logs.Logs, 200);
            PreferDetailsFocus = true;
            Status = "Maintenance: logs OK";
        }
        catch (Exception ex)
        {
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await RefreshMaintenanceLogsAsync().ConfigureAwait(true);
                return;
            }
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task RefreshMaintenanceServiceStatusAsync()
    {
        if (IsBusy)
        {
            return;
        }

        try
        {
            if (!await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true))
            {
                Status = "Maintenance: token requis";
                return;
            }

            IsBusy = true;
            Status = "Maintenance: status service…";

            var backend = await _maintenance.GetBackendServiceStatusAsync().ConfigureAwait(true);
            var message = FormatDeployStatus(backend);
            Details = "Backend:\n" + message;
            PreferDetailsFocus = true;
            await _dialogs.ShowInfo("Maintenance", message).ConfigureAwait(true);
            Status = "Maintenance: status OK";
        }
        catch (Exception ex)
        {
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await RefreshMaintenanceServiceStatusAsync().ConfigureAwait(true);
                return;
            }
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task DeployBackendAsync()
    {
        if (IsBusy)
        {
            return;
        }

        if (!await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true))
        {
            Status = "Déploiement: token requis";
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
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await DeployBackendAsync().ConfigureAwait(true);
                return;
            }
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
