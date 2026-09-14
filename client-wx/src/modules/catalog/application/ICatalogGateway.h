#pragma once

#include <stop_token>
#include "modules/catalog/domain/CatalogSnapshot.h"

namespace lila::modules::catalog::application
{
class ICatalogGateway
{
public:
    virtual ~ICatalogGateway() = default;
    [[nodiscard]] virtual domain::CatalogSnapshot GetCatalog(
        std::stop_token stopToken) const = 0;
};
}
