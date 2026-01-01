using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Network.Services;

public interface IApiCapabilitiesService
{
    Task<ApiCapabilities> GetAsync(CancellationToken cancellationToken = default);
}

public sealed class ApiCapabilities
{
    public bool SupportsAdminRoomsList { get; init; }
    public bool SupportsAdminRoomsDestroy { get; init; }
    public bool SupportsAdminRoomsCleanup { get; init; }
    public int RoutesCount { get; init; }
    public string GeneratedAt { get; init; } = string.Empty;
}

