using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Core.Network;
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
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static ClientUpdateInfo? _cache;
    private static DateTime _cacheAtUtc = DateTime.MinValue;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(20);

    public static Task<ClientUpdateInfo?> GetAsync(
        ClientConfiguration config,
        CancellationToken cancellationToken = default)
        => GetAsync(config, forceRefresh: false, cancellationToken);

    public static async Task<ClientUpdateInfo?> GetAsync(
        ClientConfiguration config,
        bool forceRefresh = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var cached = _cache;
            if (!forceRefresh && cached != null && DateTime.UtcNow - _cacheAtUtc < CacheTtl)
            {
                return cached;
            }

            await Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                cached = _cache;
                if (!forceRefresh && cached != null && DateTime.UtcNow - _cacheAtUtc < CacheTtl)
                {
                    return cached;
                }

                var current = AppInfo.GetShortVersion()?.Trim();
                var baseEndpoint = config.UpdatesCheckUrl;
                var endpoint = BuildEndpoint(baseEndpoint, current, forceRefresh);

                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(4));

                using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
                request.Headers.CacheControl = new CacheControlHeaderValue
                {
                    NoCache = true,
                    NoStore = true,
                    MaxAge = TimeSpan.Zero,
                    MustRevalidate = true,
                };
                request.Headers.Pragma.Add(new NameValueHeaderValue("no-cache"));

                using var response = await HttpClientProvider.Shared
                    .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token)
                    .ConfigureAwait(false);
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }

            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var info = new ClientUpdateInfo
            {
                LatestVersion = root.TryGetProperty("version", out var v) ? v.GetString() : null,
                Message = root.TryGetProperty("message", out var m) ? m.GetString() : null,
                Url = root.TryGetProperty("url", out var u) ? u.GetString() : null,
                MinRequiredVersion = root.TryGetProperty("minRequiredVersion", out var min) ? min.GetString() : null,
                UpdateAvailable = TryReadBoolean(root, "updateAvailable"),
                UpdateRequired = TryReadBoolean(root, "updateRequired"),
            };
            _cache = info;
            _cacheAtUtc = DateTime.UtcNow;
            return info;
            }
            finally
            {
                Gate.Release();
            }
        }
        catch
        {
            return null;
        }
    }

    private static Uri BuildEndpoint(Uri baseEndpoint, string? current, bool forceRefresh)
    {
        var builder = new UriBuilder(baseEndpoint);
        var baseQuery = (builder.Query ?? string.Empty).TrimStart('?');
        var query =
            string.IsNullOrWhiteSpace(baseQuery)
                ? string.Empty
                : baseQuery + "&";
        query += $"current={Uri.EscapeDataString(current ?? string.Empty)}";
        if (forceRefresh)
        {
            query += $"&_cb={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        }

        builder.Query = query;
        return builder.Uri;
    }

    private static bool? TryReadBoolean(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var node))
        {
            return null;
        }

        return node.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => node.TryGetInt32(out var n) ? n != 0 : null,
            JsonValueKind.String => bool.TryParse(node.GetString(), out var b) ? b : null,
            _ => null,
        };
    }
}
