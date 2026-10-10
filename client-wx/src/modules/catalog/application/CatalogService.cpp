#include "modules/catalog/application/CatalogService.h"

#include "modules/catalog/application/ICatalogGateway.h"

namespace lila::modules::catalog::application
{
CatalogService::CatalogService(ICatalogGateway& gateway) noexcept : gateway_(gateway) {}

domain::CatalogSnapshot CatalogService::LoadCatalog(std::stop_token stopToken) const
{
    return gateway_.GetCatalog(stopToken);
}
}
