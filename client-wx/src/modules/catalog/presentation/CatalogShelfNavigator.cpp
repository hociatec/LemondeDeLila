#include "modules/catalog/presentation/CatalogShelfNavigator.h"

#include <stdexcept>
#include <utility>

namespace lila::modules::catalog::presentation
{
void CatalogShelfNavigator::Reset(std::vector<domain::CatalogShelf> shelves)
{
    levels_.clear();
    roots_ = std::move(shelves);
    levels_.push_back({&roots_, 0});
    currentGames_ = nullptr;
    selectedGameIndex_ = 0;
}

void CatalogShelfNavigator::ResetToRoot()
{
    currentGames_ = nullptr;
    selectedGameIndex_ = 0;
    if (levels_.empty())
    {
        levels_.push_back({&roots_, 0});
        return;
    }
    levels_.resize(1);
    levels_.front().shelves = &roots_;
    levels_.front().selectedIndex = 0;
}

void CatalogShelfNavigator::Select(std::size_t index)
{
    if (currentGames_ != nullptr)
    {
        if (index >= currentGames_->size())
        {
            throw std::out_of_range("Catalog game selection is out of range.");
        }
        selectedGameIndex_ = index;
        return;
    }
    if (levels_.empty())
    {
        throw std::logic_error("Catalog shelves have not been initialized.");
    }
    auto& level = levels_.back();
    if (level.shelves == nullptr || index >= level.shelves->size())
    {
        throw std::out_of_range("Catalog shelf selection is out of range.");
    }
    level.selectedIndex = index;
}

bool CatalogShelfNavigator::Enter(std::size_t index)
{
    Select(index);
    const auto& children = levels_.back().shelves->at(index).children;
    const auto& games = levels_.back().shelves->at(index).games;
    if (!children.empty())
    {
        levels_.push_back({&children, 0});
        return true;
    }
    if (games.empty())
    {
        return false;
    }
    currentGames_ = &games;
    selectedGameIndex_ = 0;
    return true;
}

bool CatalogShelfNavigator::Back()
{
    if (currentGames_ != nullptr)
    {
        currentGames_ = nullptr;
        return true;
    }
    if (levels_.size() <= 1)
    {
        return false;
    }
    levels_.pop_back();
    return true;
}

bool CatalogShelfNavigator::Empty() const
{
    return currentGames_ != nullptr ? currentGames_->empty() : CurrentShelves().empty();
}

bool CatalogShelfNavigator::IsAtRoot() const noexcept
{
    return currentGames_ == nullptr && levels_.size() <= 1;
}

bool CatalogShelfNavigator::IsShowingGames() const noexcept
{
    return currentGames_ != nullptr;
}

std::size_t CatalogShelfNavigator::SelectedIndex() const
{
    return currentGames_ != nullptr ? selectedGameIndex_ : (levels_.empty() ? 0 : levels_.back().selectedIndex);
}

const std::vector<domain::CatalogShelf>& CatalogShelfNavigator::CurrentShelves() const
{
    return levels_.empty() ? roots_ : *levels_.back().shelves;
}

const std::vector<domain::CatalogGame>& CatalogShelfNavigator::CurrentGames() const
{
    static const std::vector<domain::CatalogGame> empty;
    return currentGames_ != nullptr ? *currentGames_ : empty;
}
}
