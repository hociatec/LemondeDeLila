#pragma once

#include <stop_token>
#include <vector>

#include "modules/catalog/domain/CatalogShelf.h"

namespace lila::modules::catalog::application
{
class ICatalogGateway
{
public:
    virtual ~ICatalogGateway() = default;
    [[nodiscard]] virtual std::vector<domain::CatalogShelf> GetShelves(std::stop_token stopToken) const = 0;
};
}
