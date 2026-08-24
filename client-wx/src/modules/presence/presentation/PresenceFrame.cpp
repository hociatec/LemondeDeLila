#include "modules/presence/presentation/PresenceFrame.h"

#include <utility>

#include <wx/weakref.h>

#include "modules/presence/application/PresenceMonitor.h"
#include "modules/presence/presentation/PresenceActionController.h"
#include "modules/session/application/SessionStore.h"
#include "modules/social/application/SocialService.h"
#include "shared/accessibility/FocusManager.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::presence::presentation
{
PresenceFrame::PresenceFrame(
    wxWindow* parent,
    lila::modules::presence::application::PresenceMonitor& presenceMonitor,
    lila::modules::social::application::SocialService& socialService,
    lila::modules::messaging::application::MessagingService& messagingService,
    lila::modules::session::application::SessionStore& sessionStore,
    OpenStoryBookRequestedHandler onOpenStoryBookRequested,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      presenceMonitor_(presenceMonitor),
      sessionStore_(sessionStore),
      actionController_(std::make_unique<PresenceActionController>(socialService, messagingService)),
      onOpenStoryBookRequested_(std::move(onOpenStoryBookRequested)),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    BuildLayout();
    BindEvents();
    presenceMonitor_.SetPlayersChangedHandler(
        [this]()
        {
            wxWeakRef<PresenceFrame> weakThis(this);
            CallAfter(
                [weakThis]()
                {
                    if (weakThis)
                    {
                        weakThis->RefreshPlayers();
                    }
                });
        });
}

PresenceFrame::~PresenceFrame()
{
    presenceMonitor_.SetPlayersChangedHandler({});
    if (activeTask_ != nullptr)
    {
        activeTask_->RequestCancel();
    }
}

lila::shared::accessibility::FocusManager::Plan PresenceFrame::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    if (menu_ == nullptr || menu_->GetItemCount() == 0)
    {
        return plan;
    }

    menu_->SetSelectedIndexSilently(menu_->GetSelectedIndex());
    plan.AddWindow(menu_->GetSelectedControl());
    return plan;
}

void PresenceFrame::ResetForOpen()
{
    page_ = Page::Players;
    selectedPlayer_.reset();
    socialState_.reset();
    busy_ = false;
    RefreshPlayers();
}
}
