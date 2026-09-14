#include "modules/catalog/application/CatalogService.h"

#include "modules/catalog/application/ICatalogGateway.h"

namespace lila::modules::catalog::application
{
CatalogService::CatalogService(ICatalogGateway& gateway) noexcept : gateway_(gateway) {}

domain::CatalogSnapshot CatalogService::LoadCatalog(std::stop_token stopToken) const
{
    auto catalog = catalogCache_.GetOrLoad(
        stopToken,
        [this](std::stop_token token) { return gateway_.GetCatalog(token); });
    return catalog.value_or(domain::CatalogSnapshot{});
}

void CatalogService::ClearCache()
{
    catalogCache_.Clear();
}
}
