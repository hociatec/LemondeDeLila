#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>
#include <utility>

#include "modules/admin/application/AdminService.h"
#include "shared/security/infrastructure/SecurityUtils.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
AdminFrame::AdminFrame(
    wxWindow* parent,
    application::AdminService& service,
    CloseRequestedHandler onCloseRequested,
    JoinRoomRequestedHandler onJoinRoomRequested,
    std::size_t initialSection)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      service_(service), onCloseRequested_(std::move(onCloseRequested)),
      onJoinRoomRequested_(std::move(onJoinRoomRequested)),
      selectedSection_(std::min(initialSection, domain::GetAdminSections().size() - 1))
{
    BuildLayout();
    BindEvents();
    ShowSections();
}

AdminFrame::~AdminFrame()
{
    requestSlot_.Cancel();
    lila::shared::security::SecureWipeString(maintenanceToken_);
}

lila::shared::accessibility::FocusManager::Plan AdminFrame::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    auto* menu = showingCommands_ ? commandsMenu_ : sectionsMenu_;
    if (menu != nullptr && menu->GetItemCount() > 0)
        plan.AddWindow(menu->GetSelectedControl());
    return plan;
}
}
