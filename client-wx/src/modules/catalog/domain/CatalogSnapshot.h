#pragma once

#include <vector>

#include "modules/catalog/domain/CatalogShelf.h"

namespace lila::modules::catalog::domain
{
struct CatalogSnapshot final
{
    std::vector<CatalogShelf> shelves;
    bool administrator = false;
};
}
