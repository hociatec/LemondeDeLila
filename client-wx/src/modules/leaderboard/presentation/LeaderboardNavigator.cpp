#include "modules/leaderboard/presentation/LeaderboardNavigator.h"

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace lila::modules::leaderboard::presentation
{
void LeaderboardNavigator::ResetGames(std::vector<domain::LeaderboardGame> games)
{
    games_ = std::move(games);
    entries_.clear();
    gameIndex_ = 0;
    page_ = Page::Games;
    selections_.fill(0);
}

void LeaderboardNavigator::ShowGames() noexcept
{
    page_ = Page::Games;
}

void LeaderboardNavigator::OpenTop(std::size_t gameIndex, domain::LeaderboardTop top)
{
    if (gameIndex >= games_.size() || top.gameType != games_[gameIndex].gameType)
    {
        throw std::out_of_range("Leaderboard game selection is invalid.");
    }
    gameIndex_ = gameIndex;
    selections_[PageIndex(Page::Games)] = gameIndex;
    selections_[PageIndex(Page::Top)] = 0;
    entries_ = std::move(top.entries);
    page_ = Page::Top;
}

void LeaderboardNavigator::Select(std::size_t index)
{
    if (index >= ItemCount())
    {
        throw std::out_of_range("Leaderboard selection is out of range.");
    }
    selections_[PageIndex(page_)] = index;
}

bool LeaderboardNavigator::Back() noexcept
{
    if (page_ != Page::Top)
    {
        return false;
    }
    page_ = Page::Games;
    return true;
}

LeaderboardNavigator::Page LeaderboardNavigator::CurrentPage() const noexcept
{
    return page_;
}

std::size_t LeaderboardNavigator::SelectedIndex() const noexcept
{
    return selections_[PageIndex(page_)];
}

std::size_t LeaderboardNavigator::ItemCount() const noexcept
{
    if (page_ == Page::Games)
    {
        return games_.empty() ? 1 : games_.size();
    }
    return entries_.empty() ? 1 : std::min<std::size_t>(entries_.size(), 10);
}

const std::vector<domain::LeaderboardGame>& LeaderboardNavigator::Games() const noexcept
{
    return games_;
}

const domain::LeaderboardGame* LeaderboardNavigator::CurrentGame() const noexcept
{
    return gameIndex_ < games_.size() ? &games_[gameIndex_] : nullptr;
}

const std::vector<domain::LeaderboardEntry>& LeaderboardNavigator::Entries() const noexcept
{
    return entries_;
}
}
