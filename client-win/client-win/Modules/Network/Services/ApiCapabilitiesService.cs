using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
using System.Text;
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

        var localIsAdmin = IsAdminFromToken(token);

        var res = await _ws.RequestAsync<ApiCapabilitiesPayload>(
            "api.capabilities",
            new { },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success)
        {
            // Ne pas mettre en cache une réponse en échec : on retentera au prochain appel
            // et on s'appuie sur les rôles du JWT comme filet de sécurité.
            lock (_sync)
            {
                if (_cached != null)
                {
                    return _cached;
                }
            }
            return new ApiCapabilities
            {
                IsAdmin = localIsAdmin,
                SupportsAdminRoomsList = false,
                SupportsAdminRoomsDestroy = false,
                SupportsAdminRoomsCleanup = false,
                RoutesCount = 0,
                WsTypes = Array.Empty<string>(),
                GeneratedAt = string.Empty,
            };
        }

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
            IsAdmin = localIsAdmin || (res.Payload?.IsAdmin == true),
            SupportsAdminRoomsList = res.Payload?.Features?.GetValueOrDefault("admin.rooms.list") == true,
            SupportsAdminRoomsDestroy = res.Payload?.Features?.GetValueOrDefault("admin.rooms.destroy") == true,
            SupportsAdminRoomsCleanup = res.Payload?.Features?.GetValueOrDefault("admin.rooms.cleanup") == true,
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

    private static bool IsAdminFromToken(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        try
        {
            var parts = token.Split('.');
            if (parts.Length < 2) return false;

            static string Pad(string s)
            {
                s = s.Replace('-', '+').Replace('_', '/');
                var mod = s.Length % 4;
                return mod == 0 ? s : s + new string('=', 4 - mod);
            }

            var payloadJson = Encoding.UTF8.GetString(Convert.FromBase64String(Pad(parts[1])));
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("roles", out var rolesEl))
            {
                return false;
            }

            if (rolesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var roleEl in rolesEl.EnumerateArray())
                {
                    if (roleEl.ValueKind == JsonValueKind.String && IsAdminRole(roleEl.GetString()))
                    {
                        return true;
                    }
                }
            }
            else if (rolesEl.ValueKind == JsonValueKind.String && IsAdminRole(rolesEl.GetString()))
            {
                return true;
            }

            return false;
        }
        catch
        {
            // Parse best-effort only.
            return false;
        }
    }

    private static bool IsAdminRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return false;
        return string.Equals(role, "ROLE_ADMIN", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
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
