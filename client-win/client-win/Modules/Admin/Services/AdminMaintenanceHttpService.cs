using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Network;
using client_win.Modules.Admin.Dtos;
using client_win.Modules.Config;

namespace client_win.Modules.Admin.Services;

public sealed class AdminMaintenanceHttpService : IAdminMaintenanceHttpService
{
    private readonly ClientConfiguration _config;
    private readonly IApiHttpClient _apiHttp;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public AdminMaintenanceHttpService(ClientConfiguration config, IApiHttpClient apiHttp)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _apiHttp = apiHttp ?? throw new ArgumentNullException(nameof(apiHttp));
    }

    public async Task<AdminMaintenanceStartDeployResponse> StartDeployAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Post, new Uri(_config.HttpBase, "admin/maintenance/deploy"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(8), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceStartDeployResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    public async Task<AdminMaintenanceUnitStatusResponse> GetDeployStatusAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Get, new Uri(_config.HttpBase, "admin/maintenance/deploy/status"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(6), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceUnitStatusResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    public async Task<AdminMaintenanceLogsResponse> GetDeployLogsAsync(int tail = 200, CancellationToken cancellationToken = default)
    {
        tail = Math.Clamp(tail, 1, 2000);
        var uri = new Uri(_config.HttpBase, "admin/maintenance/deploy/logs?tail=" + tail);
        using var req = CreateAuthenticatedRequest(HttpMethod.Get, uri);
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(8), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceLogsResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    public async Task<AdminMaintenanceUnitStatusResponse> GetBackendServiceStatusAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Get, new Uri(_config.HttpBase, "admin/maintenance/service/status"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(6), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceUnitStatusResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    private HttpRequestMessage CreateAuthenticatedRequest(HttpMethod method, Uri uri)
    {
        var token = (_config.AdminMaintenanceToken ?? string.Empty).Trim();
        if (token.Length == 0)
        {
            throw new InvalidOperationException(
                "Token de maintenance manquant. Configurez 'admin.maintenance.token' dans client.properties (ou CLIENT_ADMIN_MAINTENANCE_TOKEN).");
        }

        var req = new HttpRequestMessage(method, uri);
        req.Headers.TryAddWithoutValidation("x-admin-maintenance-token", token);
        return req;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            var msg = ApiErrorParser.TryExtractMessage(body) ?? body ?? response.ReasonPhrase ?? "Erreur API";
            throw new InvalidOperationException(msg.Trim().Length == 0 ? "Erreur API" : msg.Trim());
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<T>(body, JsonOptions);
            if (parsed == null)
            {
                throw new InvalidOperationException("Réponse API invalide.");
            }
            return parsed;
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException("Réponse API invalide.", ex);
        }
    }
}

