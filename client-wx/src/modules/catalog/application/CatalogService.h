#pragma once

#include <stop_token>
#include "modules/catalog/domain/CatalogSnapshot.h"
#include "shared/cache/application/SingleFlightCache.h"

namespace lila::modules::catalog::application
{
class ICatalogGateway;

class CatalogService final
{
public:
    explicit CatalogService(ICatalogGateway& gateway) noexcept;
    [[nodiscard]] domain::CatalogSnapshot LoadCatalog(std::stop_token stopToken) const;
    void ClearCache();

private:
    ICatalogGateway& gateway_;
    mutable lila::shared::cache::SingleFlightCache<domain::CatalogSnapshot> catalogCache_;
};
}
