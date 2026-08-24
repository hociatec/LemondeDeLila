#include "modules/leaderboard/presentation/LeaderboardPanel.h"

#include "shared/accessibility/application/NavigationController.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::leaderboard::presentation
{
void LeaderboardPanel::BindEvents()
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

void LeaderboardPanel::HandleActivation(std::size_t index)
{
    if (state_ == State::Loading)
    {
        return;
    }
    if (state_ == State::Error)
    {
        if (pendingRequest_ == Request::Top)
        {
            LoadTop(pendingGameIndex_);
        }
        else
        {
            LoadGames();
        }
        return;
    }
    if (navigator_.CurrentPage() == LeaderboardNavigator::Page::Games &&
        !navigator_.Games().empty())
    {
        LoadTop(index);
    }
}

void LeaderboardPanel::HandleEscape()
{
    if (state_ == State::Loading && pendingRequest_ == Request::Top)
    {
        CancelRequest();
        state_ = State::Ready;
        ShowCurrentPage();
        return;
    }
    if (state_ == State::Error && pendingRequest_ == Request::Top)
    {
        state_ = State::Ready;
        ShowCurrentPage();
        return;
    }
    if (navigator_.Back())
    {
        state_ = State::Ready;
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
