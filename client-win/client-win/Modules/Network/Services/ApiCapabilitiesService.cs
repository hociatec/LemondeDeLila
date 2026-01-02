using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.User.Services;

namespace client_win.Modules.Network.Services;

public sealed class ApiCapabilitiesService : IApiCapabilitiesService, IDisposable
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;
    private readonly PersistentWsClient _transport;
    private readonly object _sync = new();

    private ApiCapabilities? _cached;
    private DateTime _cachedAtUtc;
    private readonly TimeSpan _ttl = TimeSpan.FromMinutes(5);

    public ApiCapabilitiesService(WsRequestClient ws, ISessionService session, PersistentWsClient transport)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _transport = transport ?? throw new ArgumentNullException(nameof(transport));
        _transport.Connected += OnTransportConnected;
    }

    public Task<ApiCapabilities> GetAsync(CancellationToken cancellationToken = default)
    {
        lock (_sync)
        {
            if (_cached != null && (DateTime.UtcNow - _cachedAtUtc) < _ttl)
            {
                return Task.FromResult(_cached);
            }
        }

        return FetchAsync(cancellationToken);
    }

    private async Task<ApiCapabilities> FetchAsync(CancellationToken cancellationToken)
    {
        var token = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            return new ApiCapabilities();
        }

        var res = await _ws.RequestAsync<ApiCapabilitiesPayload>(
            "api.capabilities",
            new { },
            token,
            cancellationToken).ConfigureAwait(false);

        var wsTypes = res.Success && res.Payload?.WsTypes != null
            ? res.Payload.WsTypes
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray()
            : Array.Empty<string>();

        _transport.SetSupportedWsTypes(wsTypes);

        var capabilities = new ApiCapabilities
        {
            IsAdmin = res.Success && res.Payload?.IsAdmin == true,
            SupportsAdminRoomsList = res.Success && res.Payload?.Features?.GetValueOrDefault("admin.rooms.list") == true,
            SupportsAdminRoomsDestroy = res.Success && res.Payload?.Features?.GetValueOrDefault("admin.rooms.destroy") == true,
            SupportsAdminRoomsCleanup = res.Success && res.Payload?.Features?.GetValueOrDefault("admin.rooms.cleanup") == true,
            RoutesCount = res.Payload?.RoutesCount ?? 0,
            WsTypes = wsTypes,
            GeneratedAt = res.Payload?.GeneratedAt ?? string.Empty
        };

        lock (_sync)
        {
            _cached = capabilities;
            _cachedAtUtc = DateTime.UtcNow;
        }

        return capabilities;
    }

    private void OnTransportConnected()
    {
        lock (_sync)
        {
            _cached = null;
            _cachedAtUtc = DateTime.MinValue;
        }
    }

    public void Dispose()
    {
        _transport.Connected -= OnTransportConnected;
    }

    private sealed class ApiCapabilitiesPayload
    {
        [JsonPropertyName("isAdmin")]
        public bool IsAdmin { get; set; }

        [JsonPropertyName("features")]
        public Dictionary<string, bool>? Features { get; set; }

        [JsonPropertyName("routesCount")]
        public int RoutesCount { get; set; }

        [JsonPropertyName("wsTypes")]
        public string[]? WsTypes { get; set; }

        [JsonPropertyName("generatedAt")]
        public string? GeneratedAt { get; set; }
    }
}
