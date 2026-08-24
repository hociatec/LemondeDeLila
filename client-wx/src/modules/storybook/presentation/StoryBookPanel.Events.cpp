#include "modules/storybook/presentation/StoryBookPanel.h"

#include "shared/accessibility/NavigationController.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::storybook::presentation
{
void StoryBookPanel::BindEvents()
{
    menu_->SetSelectionChangedHandler(
        [this](std::size_t index)
        {
            if (state_ == State::Ready)
            {
                navigator_.Select(index);
            }
        });
    menu_->SetActivatedHandler([this](std::size_t index) { HandleActivation(index); });
    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        *this,
        [this]()
        {
            HandleEscape();
            return true;
        });
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
