using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Config;

namespace client_win.Modules.Updates;

public sealed class ClientUpdateInfo
{
    public string? LatestVersion { get; init; }
    public string? Message { get; init; }
    public string? Url { get; init; }
    public string? MinRequiredVersion { get; init; }
    public bool? UpdateAvailable { get; init; }
    public bool? UpdateRequired { get; init; }
}

public static class ClientUpdateApi
{
    public static async Task<ClientUpdateInfo?> GetAsync(ClientConfiguration config, CancellationToken cancellationToken = default)
    {
        try
        {
            var current = AppInfo.GetShortVersion()?.Trim();
            var endpoint = new Uri(config.HttpBase, $"../client/version?current={Uri.EscapeDataString(current ?? string.Empty)}");
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
            using var response = await http.GetAsync(endpoint, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            return new ClientUpdateInfo
            {
                LatestVersion = root.TryGetProperty("version", out var v) ? v.GetString() : null,
                Message = root.TryGetProperty("message", out var m) ? m.GetString() : null,
                Url = root.TryGetProperty("url", out var u) ? u.GetString() : null,
                MinRequiredVersion = root.TryGetProperty("minRequiredVersion", out var min) ? min.GetString() : null,
                UpdateAvailable = root.TryGetProperty("updateAvailable", out var a) && a.ValueKind != JsonValueKind.Null ? a.GetBoolean() : null,
                UpdateRequired = root.TryGetProperty("updateRequired", out var r) && r.ValueKind != JsonValueKind.Null ? r.GetBoolean() : null,
            };
        }
        catch
        {
            return null;
        }
    }
}

