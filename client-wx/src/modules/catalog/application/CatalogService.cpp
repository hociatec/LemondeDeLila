#include "modules/catalog/application/CatalogService.h"

#include "modules/catalog/application/ICatalogGateway.h"

namespace lila::modules::catalog::application
{
CatalogService::CatalogService(ICatalogGateway& gateway) noexcept : gateway_(gateway) {}

std::vector<domain::CatalogShelf> CatalogService::LoadShelves(std::stop_token stopToken) const
{
    auto shelves = shelvesCache_.GetOrLoad(
        stopToken,
        [this](std::stop_token token) { return gateway_.GetShelves(token); });
    return shelves.value_or(std::vector<domain::CatalogShelf>{});
}

void CatalogService::ClearCache()
{
    shelvesCache_.Clear();
}
}
