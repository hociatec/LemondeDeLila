#include "modules/storybook/presentation/StoryBookNavigator.h"

#include <stdexcept>
#include <utility>

namespace lila::modules::storybook::presentation
{
void StoryBookNavigator::ResetRoot()
{
    page_ = Page::Root;
    games_.clear();
    gameIndex_ = 0;
    selections_.fill(0);
}

void StoryBookNavigator::OpenGames(std::vector<domain::StoryBookGame> games)
{
    games_ = std::move(games);
    page_ = Page::Games;
    gameIndex_ = 0;
    selections_.fill(0);
}

void StoryBookNavigator::Select(std::size_t index)
{
    if (index >= ItemCount())
    {
        throw std::out_of_range("Story book selection is out of range.");
    }
    selections_[PageIndex(page_)] = index;
}

bool StoryBookNavigator::Activate(std::size_t index)
{
    Select(index);
    if (page_ == Page::Games && !games_.empty())
    {
        gameIndex_ = index;
        page_ = Page::Modes;
        return true;
    }
    if (page_ == Page::Modes)
    {
        page_ = Page::Details;
        return true;
    }
    return false;
}

bool StoryBookNavigator::Back()
{
    switch (page_)
    {
    case Page::Details:
        page_ = Page::Modes;
        return true;
    case Page::Modes:
        page_ = Page::Games;
        return true;
    case Page::Games:
        page_ = Page::Root;
        return true;
    case Page::Root:
        return false;
    }
    return false;
}

StoryBookNavigator::Page StoryBookNavigator::CurrentPage() const noexcept
{
    return page_;
}

std::size_t StoryBookNavigator::SelectedIndex() const noexcept
{
    return selections_[PageIndex(page_)];
}

std::size_t StoryBookNavigator::ItemCount() const noexcept
{
    switch (page_)
    {
    case Page::Root:
        return 2;
    case Page::Games:
        return games_.empty() ? 1 : games_.size();
    case Page::Modes:
        return 2;
    case Page::Details:
        return 4;
    }
    return 0;
}

const std::vector<domain::StoryBookGame>& StoryBookNavigator::Games() const noexcept
{
    return games_;
}

const domain::StoryBookGame* StoryBookNavigator::CurrentGame() const noexcept
{
    return gameIndex_ < games_.size() ? &games_[gameIndex_] : nullptr;
}

const domain::StoryBookCounts* StoryBookNavigator::CurrentCounts() const noexcept
{
    const auto* game = CurrentGame();
    if (game == nullptr || page_ != Page::Details)
    {
        return nullptr;
    }
    return selections_[PageIndex(Page::Modes)] == 0 ? &game->withBots : &game->withoutBots;
}

bool StoryBookNavigator::CurrentModeUsesBots() const noexcept
{
    return selections_[PageIndex(Page::Modes)] == 0;
}
}
