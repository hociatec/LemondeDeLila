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
            await _dialogs.ShowInfo(
                    "Maintenance",
                    "Token de maintenance enregistré.\n\nVous pouvez relancer l'action.")
                .ConfigureAwait(true);
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
        Items.Add(new AdminMenuItem("Backend", tag: "maintenance.menu.backend"));
        Items.Add(new AdminMenuItem("Système (systemd)", tag: "maintenance.menu.systemd"));
        Items.Add(new AdminMenuItem("Rafraîchir (status)", tag: "maintenance.refresh"));
        Items.Add(new AdminMenuItem("Retour", tag: "maintenance.back"));
        SelectedItem = Items.FirstOrDefault();

        PreferDetailsFocus = false;
        IsTextInputVisible = false;
        TextInputLabel = string.Empty;
        TextInput = string.Empty;
        IsSecondaryInputVisible = false;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();

        _ = RefreshMaintenanceAsync();
    }

    private void BuildMaintenanceBackendMenu()
    {
        _page = AdminPage.MaintenanceBackend;
        Title = "Maintenance — Backend";
        Items.Clear();
        Items.Add(new AdminMenuItem("Health check (DB + Redis)", tag: "maintenance.health"));
        Items.Add(new AdminMenuItem("Status service backend", tag: "maintenance.service.status"));
        Items.Add(new AdminMenuItem("Migrations only (TypeORM)", tag: "maintenance.migrations"));
        Items.Add(new AdminMenuItem("Dry-run : build sans redémarrer", tag: "maintenance.dryrun"));
        Items.Add(new AdminMenuItem("Restart backend (redémarrage uniquement)", tag: "maintenance.restart"));
        Items.Add(new AdminMenuItem("Retour", tag: "maintenance.back"));
        SelectedItem = Items.FirstOrDefault();
        PreferDetailsFocus = false;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildMaintenanceSystemdMenu()
    {
        _page = AdminPage.MaintenanceSystemd;
        Title = "Maintenance — Système";
        Items.Clear();
        Items.Add(new AdminMenuItem("Reload config (systemd daemon-reload)", tag: "maintenance.reload"));
        Items.Add(new AdminMenuItem("Retour", tag: "maintenance.back"));
        SelectedItem = Items.FirstOrDefault();
        PreferDetailsFocus = false;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task MaintenanceHealthAsync()
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
            Status = "Maintenance: health…";

            var res = await _maintenance.GetHealthAsync().ConfigureAwait(true);
            var body = (res.Body ?? string.Empty).Trim();
            Details = $"Health ({res.StatusCode}) — {res.Url}\n\n{body}";
            PreferDetailsFocus = true;
            Status = "Maintenance: health OK";
        }
        catch (Exception ex)
        {
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await MaintenanceHealthAsync().ConfigureAwait(true);
                return;
            }
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task MaintenanceRunMigrationsAsync()
    {
        if (IsBusy)
        {
            return;
        }

        if (!await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true))
        {
            Status = "Maintenance: token requis";
            return;
        }

        var confirmed = await _dialogs.Confirm(
                "Maintenance",
                "Exécuter les migrations uniquement (npm run migration:run) ?",
                okText: "Exécuter",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirmed != true)
        {
            return;
        }

        try
        {
            IsBusy = true;
            Status = "Maintenance: migrations…";

            var res = await _maintenance.RunMigrationsAsync().ConfigureAwait(true);
            Details = $"Command: {res.Command}\nExit: {res.Status}\n\nSTDOUT:\n{TailLines(res.Stdout, 200)}\n\nSTDERR:\n{TailLines(res.Stderr, 80)}";
            PreferDetailsFocus = true;
            Status = "Maintenance: migrations OK";
        }
        catch (Exception ex)
        {
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await MaintenanceRunMigrationsAsync().ConfigureAwait(true);
                return;
            }
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task MaintenanceDryRunBuildAsync()
    {
        if (IsBusy)
        {
            return;
        }

        if (!await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true))
        {
            Status = "Maintenance: token requis";
            return;
        }

        var confirmed = await _dialogs.Confirm(
                "Maintenance",
                "Dry-run : compiler le backend (npm run build) sans redémarrer ?",
                okText: "Compiler",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirmed != true)
        {
            return;
        }

        try
        {
            IsBusy = true;
            Status = "Maintenance: build…";

            var res = await _maintenance.DryRunBuildAsync().ConfigureAwait(true);
            Details = $"Command: {res.Command}\nExit: {res.Status}\n\nSTDOUT:\n{TailLines(res.Stdout, 200)}\n\nSTDERR:\n{TailLines(res.Stderr, 80)}";
            PreferDetailsFocus = true;
            Status = "Maintenance: build OK";
        }
        catch (Exception ex)
        {
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await MaintenanceDryRunBuildAsync().ConfigureAwait(true);
                return;
            }
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task MaintenanceDaemonReloadAsync()
    {
        if (IsBusy)
        {
            return;
        }

        if (!await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true))
        {
            Status = "Maintenance: token requis";
            return;
        }

        var confirmed = await _dialogs.Confirm(
                "Maintenance",
                "Recharger la configuration systemd (daemon-reload) ?\n\nNote: ceci ne redémarre pas le backend.",
                okText: "Recharger",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirmed != true)
        {
            return;
        }

        try
        {
            IsBusy = true;
            Status = "Maintenance: reload…";

            var res = await _maintenance.DaemonReloadAsync().ConfigureAwait(true);
            Details = $"Command: {res.Command}\nExit: {res.Status}\n\nSTDOUT:\n{TailLines(res.Stdout, 80)}\n\nSTDERR:\n{TailLines(res.Stderr, 80)}";
            PreferDetailsFocus = true;
            Status = "Maintenance: reload OK";
        }
        catch (Exception ex)
        {
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await MaintenanceDaemonReloadAsync().ConfigureAwait(true);
                return;
            }
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task MaintenanceRestartBackendAsync()
    {
        if (IsBusy)
        {
            return;
        }

        if (!await EnsureMaintenanceTokenAsync(promptIfMissing: true).ConfigureAwait(true))
        {
            Status = "Maintenance: token requis";
            return;
        }

        var confirmed = await _dialogs.Confirm(
                "Maintenance",
                "Redémarrer le backend maintenant ?\n\nNote: la connexion sera coupée quelques secondes.",
                okText: "Redémarrer",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirmed != true)
        {
            return;
        }

        try
        {
            IsBusy = true;
            Status = "Maintenance: restart…";
            Details = string.Empty;

            // L'endpoint renvoie un ACK avant de redémarrer effectivement (planifié côté serveur).
            _ = await _maintenance.RestartBackendAsync().ConfigureAwait(true);

            var deadline = DateTimeOffset.UtcNow.AddSeconds(45);
            var attempt = 0;
            while (DateTimeOffset.UtcNow < deadline)
            {
                attempt++;
                try
                {
                    var status = await _maintenance.GetBackendServiceStatusAsync().ConfigureAwait(true);
                    Details = "Backend:\n" + FormatDeployStatus(status);
                    PreferDetailsFocus = true;
                    Status = "Maintenance: restart OK";
                    return;
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
                {
                    Status = "Maintenance: attente backend…";
                    await Task.Delay(RetryStrategy.CalculateDelay(attempt, baseDelayMs: 750, maxDelayMs: 5000))
                        .ConfigureAwait(true);
                }
            }

            Status = "Maintenance: restart (timeout)";
        }
        catch (Exception ex)
        {
            if (await EnsureMaintenanceTokenOrUpdateAsync(ex).ConfigureAwait(true))
            {
                await MaintenanceRestartBackendAsync().ConfigureAwait(true);
                return;
            }
            await _dialogs.ShowError("Maintenance", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
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
            Details = "Backend:\n" + FormatDeployStatus(backend);

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
