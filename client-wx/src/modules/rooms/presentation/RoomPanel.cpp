#include "modules/rooms/presentation/RoomPanel.h"

#include <utility>

#include "modules/rooms/application/RoomSessionService.h"
#include "modules/rooms/presentation/RoomGameZoneAnchor.h"
#include "shared/accessibility/presentation/ActionButton.h"
#include "shared/concurrency/application/BackgroundExecutor.h"

namespace lila::modules::rooms::presentation
{
RoomPanel::RoomPanel(
    wxWindow* parent,
    application::RoomSessionService& roomService,
    lila::modules::audio::application::IAudioService& audioService,
    CurrentUserIdProvider currentUserId,
    SaveRequestedHandler onSaveRequested,
    AbandonRequestedHandler onAbandonRequested,
    CloseRequestedHandler onCloseRequested)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      roomService_(roomService),
      audioService_(audioService),
      currentUserId_(std::move(currentUserId)),
      onSaveRequested_(std::move(onSaveRequested)),
      onAbandonRequested_(std::move(onAbandonRequested)),
      onCloseRequested_(std::move(onCloseRequested))
{
    BuildLayout();
    BindEvents();
    AttachEventHandler();
}

RoomPanel::~RoomPanel()
{
    roomService_.ClearEventHandler();
    CancelRequest();
    roomService_.Close();
}

lila::shared::accessibility::FocusManager::Plan RoomPanel::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    plan.AddWindow(gameZoneAnchor_);
    return plan;
}

void RoomPanel::CancelRequest()
{
    requestSlot_.Cancel();
}

}
