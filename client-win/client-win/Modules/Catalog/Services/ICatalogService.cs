using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Catalog.Models;

namespace client_win.Modules.Catalog.Services;

public interface ICatalogService
{
    Task<CatalogPayload> GetCatalogAsync(CancellationToken cancellationToken = default);
}
