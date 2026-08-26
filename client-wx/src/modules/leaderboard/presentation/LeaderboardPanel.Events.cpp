#include "modules/leaderboard/presentation/LeaderboardPanel.h"

#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/layout/ListPagePresentation.h"

namespace lila::modules::leaderboard::presentation
{
void LeaderboardPanel::BindEvents()
{
    lila::shared::ui::layout::BindNavigatedListPageMenu(
        *this,
        *menu_,
        navigator_,
        [this] { return state_ == State::Ready; },
        [this](std::size_t index) { HandleActivation(index); },
        [this] { HandleEscape(); });
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
