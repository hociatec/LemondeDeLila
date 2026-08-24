#pragma once

#include <cstddef>
#include <vector>

#include "modules/catalog/domain/CatalogShelf.h"

namespace lila::modules::catalog::presentation
{
class CatalogShelfNavigator final
{
public:
    void Reset(std::vector<domain::CatalogShelf> shelves);
    void ResetToRoot();
    void Select(std::size_t index);
    [[nodiscard]] bool Enter(std::size_t index);
    [[nodiscard]] bool Back();

    [[nodiscard]] bool Empty() const;
    [[nodiscard]] bool IsAtRoot() const noexcept;
    [[nodiscard]] bool IsShowingGames() const noexcept;
    [[nodiscard]] std::size_t SelectedIndex() const;
    [[nodiscard]] const std::vector<domain::CatalogShelf>& CurrentShelves() const;
    [[nodiscard]] const std::vector<domain::CatalogGame>& CurrentGames() const;

private:
    struct Level
    {
        const std::vector<domain::CatalogShelf>* shelves = nullptr;
        std::size_t selectedIndex = 0;
    };

    std::vector<domain::CatalogShelf> roots_;
    std::vector<Level> levels_;
    const std::vector<domain::CatalogGame>* currentGames_ = nullptr;
    std::size_t selectedGameIndex_ = 0;
};
}
