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
    private readonly ConcurrentDictionary<string, CachedTicket> _cache = new(StringComparer.OrdinalIgnoreCase);

    public WsTicketProvider(ClientConfiguration config, ISessionService session)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
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
        // HttpBase is configured as .../api/; we want .../ws/ticket.
        var ticketUri = new Uri(baseUri, "../ws/ticket?scope=" + Uri.EscapeDataString(scope));

        using var req = new HttpRequestMessage(HttpMethod.Get, ticketUri);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(6));

        using var res = await HttpClientProvider.Shared
            .SendAsync(req, timeoutCts.Token)
            .ConfigureAwait(false);
        var json = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        res.EnsureSuccessStatusCode();

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
