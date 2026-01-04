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
    private readonly IAdminMaintenanceTokenStore _tokenStore;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public AdminMaintenanceHttpService(
        ClientConfiguration config,
        IApiHttpClient apiHttp,
        IAdminMaintenanceTokenStore tokenStore)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _apiHttp = apiHttp ?? throw new ArgumentNullException(nameof(apiHttp));
        _tokenStore = tokenStore ?? throw new ArgumentNullException(nameof(tokenStore));
    }

    public async Task<AdminMaintenanceCommandResponse> DryRunBuildAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Post, new Uri(_config.HttpBase, "admin/maintenance/deploy/dry-run"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(60), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceCommandResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    public async Task<AdminMaintenanceCommandResponse> RunMigrationsAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Post, new Uri(_config.HttpBase, "admin/maintenance/migrations/run"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(60), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceCommandResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    public async Task<AdminMaintenanceRestartResponse> RestartBackendAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Post, new Uri(_config.HttpBase, "admin/maintenance/service/restart"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(8), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceRestartResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    public async Task<AdminMaintenanceRestartResponse> BuildAndRestartBackendAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Post, new Uri(_config.HttpBase, "admin/maintenance/service/build-restart"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(8), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceRestartResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    public async Task<AdminMaintenanceCommandResponse> DaemonReloadAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Post, new Uri(_config.HttpBase, "admin/maintenance/systemd/daemon-reload"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(15), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceCommandResponse>(res, cancellationToken).ConfigureAwait(false);
    }

    public async Task<AdminMaintenanceHealthResponse> GetHealthAsync(CancellationToken cancellationToken = default)
    {
        using var req = CreateAuthenticatedRequest(HttpMethod.Get, new Uri(_config.HttpBase, "admin/maintenance/health"));
        using var res = await _apiHttp.SendAuthenticatedAsync(req, TimeSpan.FromSeconds(8), cancellationToken).ConfigureAwait(false);
        return await ReadJsonAsync<AdminMaintenanceHealthResponse>(res, cancellationToken).ConfigureAwait(false);
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
            token = (_tokenStore.TryLoad() ?? string.Empty).Trim();
        }

        var req = new HttpRequestMessage(method, uri);
        if (token.Length > 0)
        {
            req.Headers.TryAddWithoutValidation("x-admin-maintenance-token", token);
        }
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
