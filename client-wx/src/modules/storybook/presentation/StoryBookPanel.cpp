#include "modules/storybook/presentation/StoryBookPanel.h"

#include <utility>

#include "modules/storybook/application/StoryBookService.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::storybook::presentation
{
StoryBookPanel::StoryBookPanel(
    wxWindow* parent,
    application::StoryBookService& service,
    OpenLeaderboardRequestedHandler onOpenLeaderboardRequested,
    CloseRequestedHandler onCloseRequested)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      service_(service),
      onOpenLeaderboardRequested_(std::move(onOpenLeaderboardRequested)),
      onCloseRequested_(std::move(onCloseRequested))
{
    BuildLayout();
    BindEvents();
    OpenOwn();
}

StoryBookPanel::~StoryBookPanel()
{
    CancelRequest();
}

void StoryBookPanel::OpenOwn()
{
    CancelRequest();
    targetUserId_.reset();
    targetUsername_.clear();
    state_ = State::Ready;
    navigator_.ResetRoot();
    ShowCurrentPage();
}

void StoryBookPanel::OpenUser(int userId, std::string username)
{
    CancelRequest();
    targetUserId_ = userId;
    targetUsername_ = std::move(username);
    navigator_.ResetRoot();
    LoadGames();
}

void StoryBookPanel::CancelRequest()
{
    requestSlot_.Cancel();
}

lila::shared::accessibility::FocusManager::Plan StoryBookPanel::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    if (menu_ != nullptr && menu_->GetItemCount() > 0)
    {
        menu_->SetSelectedIndexSilently(
            state_ == State::Ready ? navigator_.SelectedIndex() : 0);
        plan.AddWindow(menu_->GetSelectedControl());
    }
    return plan;
}
}
