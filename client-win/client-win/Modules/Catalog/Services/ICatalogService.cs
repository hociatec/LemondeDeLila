using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Catalog.Models;

namespace client_win.Modules.Catalog.Services;

public interface ICatalogService
{
    event System.EventHandler? CacheInvalidated;
    Task<CatalogPayload> GetCatalogAsync(CancellationToken cancellationToken = default);
    Task PreloadAsync(CancellationToken cancellationToken = default);
    void InvalidateCache();
}
