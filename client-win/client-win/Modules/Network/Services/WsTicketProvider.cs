using System;
using System.Collections.Concurrent;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Network;
using client_win.Modules.Config;
using client_win.Modules.User.Services;

namespace client_win.Modules.Network.Services;

public sealed class WsTicketProvider : IWsTicketProvider
{
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly IApiHttpClient _apiHttp;
    private readonly ConcurrentDictionary<string, CachedTicket> _cache = new(StringComparer.OrdinalIgnoreCase);

    public WsTicketProvider(ClientConfiguration config, ISessionService session, IApiHttpClient apiHttp)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _apiHttp = apiHttp ?? throw new ArgumentNullException(nameof(apiHttp));
    }

    public async Task<string?> GetTicketAsync(string scope, CancellationToken cancellationToken = default)
    {
        scope = (scope ?? string.Empty).Trim().ToLowerInvariant();
        if (scope.Length == 0)
        {
            return null;
        }

        if (_cache.TryGetValue(scope, out var cached) && cached.IsValid())
        {
            return cached.Ticket;
        }

        var token = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var baseUri = _config.HttpBase;
        // Some deployments expose only /api/* to the backend (reverse proxy).
        // Try /api/ws/ticket first, then fallback to /ws/ticket.
        var candidates = new[]
        {
            new Uri(baseUri, "ws/ticket?scope=" + Uri.EscapeDataString(scope)),
            new Uri(baseUri, "../ws/ticket?scope=" + Uri.EscapeDataString(scope)),
        };

        string? json = null;
        HttpResponseMessage? res = null;
        Exception? lastError = null;
        foreach (var ticketUri in candidates)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, ticketUri);
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                res?.Dispose();
                res = await _apiHttp.SendAsync(req, TimeSpan.FromSeconds(6), cancellationToken)
                    .ConfigureAwait(false);
                json = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (res.IsSuccessStatusCode)
                {
                    lastError = null;
                    break;
                }

                lastError = new HttpRequestException(
                    $"HTTP {(int)res.StatusCode} ({res.StatusCode}) sur {ticketUri}");
            }
            catch (Exception ex)
            {
                lastError = ex;
            }
        }

        res?.Dispose();
        if (lastError != null)
        {
            throw new InvalidOperationException(
                "Impossible d'obtenir un ticket WebSocket. Vérifiez que l'API expose /ws/ticket ou /api/ws/ticket.",
                lastError);
        }
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("ticket", out var t) || t.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var ticket = (t.GetString() ?? string.Empty).Trim();
        if (ticket.Length == 0)
        {
            return null;
        }

        var expiresInSeconds = root.TryGetProperty("expiresInSeconds", out var exp) && exp.ValueKind == JsonValueKind.Number
            ? exp.GetInt32()
            : 60;

        // Cache with a safety margin.
        var validUntil = DateTimeOffset.UtcNow.AddSeconds(Math.Max(5, expiresInSeconds - 5));
        _cache[scope] = new CachedTicket(ticket, validUntil);
        return ticket;
    }

    private readonly record struct CachedTicket(string Ticket, DateTimeOffset ValidUntil)
    {
        public bool IsValid() => DateTimeOffset.UtcNow < ValidUntil && !string.IsNullOrWhiteSpace(Ticket);
    }
}
