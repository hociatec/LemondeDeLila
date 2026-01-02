using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;
using client_win.Core.Network;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private AdminMaintenanceUnitStatusDto? _maintenanceDeployStatus;
    private AdminMaintenanceUnitStatusDto? _maintenanceServiceStatus;
    private AdminMaintenanceLogsDto? _maintenanceLogs;

    private void BuildMaintenance()
    {
        _page = AdminPage.Maintenance;
        Title = "Administration - Maintenance";
        Details = string.IsNullOrWhiteSpace(_config.AdminMaintenanceToken)
            ? "Maintenance serveur (build + migrations + restart).\n\nConfiguration requise côté client : admin.maintenance.token dans config/client.properties."
            : "Maintenance serveur (build + migrations + restart).";

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Déployer backend (build + migrations + restart)", tag: "maintenance.deploy"));
        Items.Add(new AdminMenuItem("Rafraîchir status (deploy)", tag: "maintenance.refresh"));
        Items.Add(new AdminMenuItem("Rafraîchir logs (deploy)", tag: "maintenance.logs"));
        Items.Add(new AdminMenuItem("Status service backend", tag: "maintenance.service.status"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task TriggerMaintenanceDeployAsync()
    {
        if (IsBusy) return;

        if (string.IsNullOrWhiteSpace(_config.AdminMaintenanceToken))
        {
            await _dialogs.ShowError("Maintenance", "Token manquant. Configure `admin.maintenance.token` dans `config/client.properties`.").ConfigureAwait(true);
            return;
        }

        var confirm = await _dialogs.Confirm(
                "Maintenance",
                "Déclencher un déploiement serveur (build + migrations + restart) ?\n\nAttention : le backend va redémarrer et couper les connexions.",
                okText: "Déployer",
                cancelText: "Annuler")
            .ConfigureAwait(true);

        if (confirm != true)
        {
            return;
        }

        IsBusy = true;
        try
        {
            await SendMaintenanceAsync<AdminMaintenanceDeployResponseDto>(HttpMethod.Post, "admin/maintenance/deploy").ConfigureAwait(true);
            Status = "Déploiement déclenché. Le serveur peut redémarrer pendant quelques secondes…";

            // Best effort polling (le restart peut faire échouer temporairement les requêtes).
            for (int i = 0; i < 30; i++)
            {
                await Task.Delay(TimeSpan.FromSeconds(2)).ConfigureAwait(true);
                try
                {
                    await RefreshMaintenanceAsync().ConfigureAwait(true);
                    var result = _maintenanceDeployStatus?.Result;
                    if (!string.IsNullOrWhiteSpace(result) &&
                        (string.Equals(result, "success", StringComparison.OrdinalIgnoreCase) ||
                         string.Equals(result, "failed", StringComparison.OrdinalIgnoreCase)))
                    {
                        break;
                    }
                }
                catch
                {
                    // ignore: serveur en redémarrage / connexion coupée
                }
            }
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

    private async Task RefreshMaintenanceAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            _maintenanceDeployStatus = await SendMaintenanceAsync<AdminMaintenanceUnitStatusDto>(HttpMethod.Get, "admin/maintenance/deploy/status").ConfigureAwait(true);
            _maintenanceLogs = await SendMaintenanceAsync<AdminMaintenanceLogsDto>(HttpMethod.Get, "admin/maintenance/deploy/logs?tail=200").ConfigureAwait(true);

            Details = BuildMaintenanceDetails(_maintenanceDeployStatus, _maintenanceLogs);
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

    private async Task RefreshMaintenanceLogsAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            _maintenanceLogs = await SendMaintenanceAsync<AdminMaintenanceLogsDto>(HttpMethod.Get, "admin/maintenance/deploy/logs?tail=200").ConfigureAwait(true);
            Details = BuildMaintenanceDetails(_maintenanceDeployStatus, _maintenanceLogs);
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

    private async Task RefreshMaintenanceServiceStatusAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            _maintenanceServiceStatus = await SendMaintenanceAsync<AdminMaintenanceUnitStatusDto>(HttpMethod.Get, "admin/maintenance/service/status").ConfigureAwait(true);
            Details = BuildMaintenanceDetails(_maintenanceDeployStatus, _maintenanceLogs, _maintenanceServiceStatus);
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

    private string BuildMaintenanceDetails(
        AdminMaintenanceUnitStatusDto? deployStatus,
        AdminMaintenanceLogsDto? deployLogs,
        AdminMaintenanceUnitStatusDto? backendServiceStatus = null)
    {
        string FormatUnit(AdminMaintenanceUnitStatusDto? s, string title)
        {
            if (s == null) return $"{title}: (non chargé)";
            return $"{title}: {s.Unit}\n" +
                   $"- Active: {s.ActiveState} / {s.SubState}\n" +
                   $"- Result: {s.Result}\n" +
                   $"- ExecMainStatus: {s.ExecMainStatus} ({s.ExecMainCode})\n" +
                   $"- Start: {s.ExecMainStartTimestamp}\n" +
                   $"- Exit: {s.ExecMainExitTimestamp}";
        }

        var text = "Maintenance serveur (build + migrations + restart)\n\n" +
                   FormatUnit(deployStatus, "Deploy") +
                   "\n\n" +
                   (backendServiceStatus == null ? string.Empty : (FormatUnit(backendServiceStatus, "Service") + "\n\n"));

        if (deployLogs != null && !string.IsNullOrWhiteSpace(deployLogs.Logs))
        {
            text += $"Logs (tail={deployLogs.Tail})\n{deployLogs.Logs}";
        }
        else
        {
            text += "Logs: (vide)";
        }

        return text;
    }

    private async Task<T> SendMaintenanceAsync<T>(HttpMethod method, string relativePath)
    {
        var jwt = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(jwt))
        {
            throw new InvalidOperationException("Connexion requise.");
        }

        var maintenanceToken = _config.AdminMaintenanceToken;
        if (string.IsNullOrWhiteSpace(maintenanceToken))
        {
            throw new InvalidOperationException("Token de maintenance manquant (admin.maintenance.token).");
        }

        var endpoint = new Uri(_config.HttpBase, relativePath);

        HttpResponseMessage resp;
        using (var req = new HttpRequestMessage(method, endpoint))
        {
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
            req.Headers.TryAddWithoutValidation("x-admin-maintenance-token", maintenanceToken);
            resp = await HttpClientProvider.Shared.SendAsync(req).ConfigureAwait(true);
        }

        var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
        if (!resp.IsSuccessStatusCode)
        {
            var message = ApiErrorParser.TryExtractMessage(body) ?? body;
            throw new InvalidOperationException($"Erreur maintenance ({(int)resp.StatusCode}) : {message}");
        }

        try
        {
            var dto = JsonSerializer.Deserialize<T>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (dto == null)
            {
                throw new InvalidOperationException("Réponse vide.");
            }
            return dto;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Réponse JSON invalide: {ex.Message}");
        }
    }
}
