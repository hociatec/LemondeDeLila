#include "modules/rooms/presentation/JoinRoomsPanel.h"

#include <algorithm>
#include <utility>

#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::rooms::presentation
{
JoinRoomsPanel::JoinRoomsPanel(
    wxWindow* parent,
    application::RoomLobbyService& service,
    JoinRequestedHandler onJoinRequested,
    CloseRequestedHandler onCloseRequested)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      service_(service),
      onJoinRequested_(std::move(onJoinRequested)),
      onCloseRequested_(std::move(onCloseRequested))
{
    BuildLayout();
    BindEvents();
}

JoinRoomsPanel::~JoinRoomsPanel()
{
    CancelRequest();
}

lila::shared::accessibility::FocusManager::Plan JoinRoomsPanel::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    if (menu_ != nullptr && menu_->GetItemCount() > 0)
    {
        const auto selected = std::min(navigator_.SelectedIndex(), menu_->GetItemCount() - 1);
        menu_->SetSelectedIndexSilently(selected);
        plan.AddWindow(menu_->GetSelectedControl());
    }
    return plan;
}

void JoinRoomsPanel::CancelRequest()
{
    requestSlot_.Cancel();
}
}
