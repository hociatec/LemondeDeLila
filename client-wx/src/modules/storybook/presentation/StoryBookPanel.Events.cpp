#include "modules/storybook/presentation/StoryBookPanel.h"

#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/layout/ListPagePresentation.h"

namespace lila::modules::storybook::presentation
{
void StoryBookPanel::BindEvents()
{
    lila::shared::ui::layout::BindNavigatedListPageMenu(
        *this,
        *menu_,
        navigator_,
        [this] { return state_ == State::Ready; },
        [this](std::size_t index) { HandleActivation(index); },
        [this] { HandleEscape(); });
}

void StoryBookPanel::HandleActivation(std::size_t index)
{
    if (state_ == State::Loading)
    {
        return;
    }
    if (state_ == State::Error)
    {
        LoadGames();
        return;
    }
    if (navigator_.CurrentPage() == StoryBookNavigator::Page::Root)
    {
        navigator_.Select(index);
        if (index == 1)
        {
            if (onOpenLeaderboardRequested_)
            {
                onOpenLeaderboardRequested_();
            }
            return;
        }
        LoadGames();
        return;
    }
    if (navigator_.Activate(index))
    {
        ShowCurrentPage();
    }
}

void StoryBookPanel::HandleEscape()
{
    if (targetUserId_.has_value() && navigator_.CurrentPage() == StoryBookNavigator::Page::Games)
    {
        if (onCloseRequested_)
        {
            onCloseRequested_();
        }
        return;
    }
    if (navigator_.Back())
    {
        ShowCurrentPage();
        return;
    }
    CancelRequest();
    if (onCloseRequested_)
    {
        onCloseRequested_();
    }
}
}
