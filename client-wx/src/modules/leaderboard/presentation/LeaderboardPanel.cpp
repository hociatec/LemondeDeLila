#include "modules/leaderboard/presentation/LeaderboardPanel.h"

#include <algorithm>
#include <utility>

#include "modules/leaderboard/application/LeaderboardService.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::leaderboard::presentation
{
LeaderboardPanel::LeaderboardPanel(
    wxWindow* parent,
    application::LeaderboardService& service,
    CloseRequestedHandler onCloseRequested)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      service_(service),
      onCloseRequested_(std::move(onCloseRequested))
{
    BuildLayout();
    BindEvents();
}

LeaderboardPanel::~LeaderboardPanel()
{
    CancelRequest();
}

void LeaderboardPanel::Prepare(PreparedHandler onPrepared)
{
    if (gamesLoaded_)
    {
        navigator_.ShowGames();
        state_ = State::Ready;
        ShowCurrentPage();
        if (onPrepared)
        {
            onPrepared();
        }
        return;
    }
    LoadGames(std::move(onPrepared));
}

lila::shared::accessibility::FocusManager::Plan LeaderboardPanel::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    if (menu_ == nullptr || menu_->GetItemCount() == 0)
    {
        return plan;
    }
    const auto selectedIndex = state_ == State::Error
        ? std::size_t{0}
        : std::min(navigator_.SelectedIndex(), menu_->GetItemCount() - 1);
    menu_->SetSelectedIndexSilently(selectedIndex);
    plan.AddWindow(menu_->GetSelectedControl());
    return plan;
}

void LeaderboardPanel::CancelRequest()
{
    requestSlot_.Cancel();
}
}
