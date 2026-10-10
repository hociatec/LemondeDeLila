#pragma once

#include <stop_token>
#include "modules/catalog/domain/CatalogSnapshot.h"

namespace lila::modules::catalog::application
{
class ICatalogGateway;

class CatalogService final
{
public:
    explicit CatalogService(ICatalogGateway& gateway) noexcept;
    [[nodiscard]] domain::CatalogSnapshot LoadCatalog(std::stop_token stopToken) const;

private:
    ICatalogGateway& gateway_;
};
}
