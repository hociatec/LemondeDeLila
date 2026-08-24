#pragma once

#include <stop_token>
#include <vector>

#include "modules/catalog/domain/CatalogShelf.h"
#include "shared/cache/SingleFlightCache.h"

namespace lila::modules::catalog::application
{
class ICatalogGateway;

class CatalogService final
{
public:
    explicit CatalogService(ICatalogGateway& gateway) noexcept;
    [[nodiscard]] std::vector<domain::CatalogShelf> LoadShelves(std::stop_token stopToken) const;
    void ClearCache();

private:
    ICatalogGateway& gateway_;
    mutable lila::shared::cache::SingleFlightCache<std::vector<domain::CatalogShelf>> shelvesCache_;
};
}
