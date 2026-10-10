#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>
#include <utility>


#include "modules/admin/application/AdminService.h"
#include "modules/audio/application/IAudioService.h"
#include "shared/security/domain/SecureWipe.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
AdminFrame::AdminFrame(
    wxWindow* parent,
    application::AdminService& service,
    lila::modules::audio::application::IAudioService& audioService,
    CloseRequestedHandler onCloseRequested,
    JoinRoomRequestedHandler onJoinRoomRequested,
    OpenStoryBookRequestedHandler onOpenStoryBookRequested,
    std::size_t initialSection)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      service_(service), audioService_(audioService),
      onCloseRequested_(std::move(onCloseRequested)),
      onJoinRoomRequested_(std::move(onJoinRoomRequested)),
      onOpenStoryBookRequested_(std::move(onOpenStoryBookRequested)),
      selectedSection_(std::min(initialSection, domain::GetAdminAreas().size() - 1))
{
    BuildLayout();
    BindEvents();
    ShowSections();
}

AdminFrame::~AdminFrame()
{
    audioService_.Preview(std::nullopt);
    requestSlot_.Cancel();
    lila::shared::security::SecureWipeString(maintenanceToken_);
}

void AdminFrame::RefreshForNavigation()
{
    if (!showingCommands_ || showingItemActions_) return;
    if (domain::GetAdminAreas()[selectedSection_].id == "reports")
    {
        if (reportStatusMenu_->GetSelectedIndex() > 0) RefreshBugReports(true, false);
        else if (!loading_) LoadAutomaticAreaContent();
    }
    else if (!loading_)
    {
        if (paginationCommand_ != nullptr)
            ExecuteCommand(*paginationCommand_, paginationPayload_, false);
        else LoadAutomaticAreaContent();
    }
}

lila::shared::accessibility::FocusManager::Plan AdminFrame::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    auto* menu = showingCommands_ ? commandsMenu_ : sectionsMenu_;
    if (showingCommands_ && !menu->IsShown() && resultsMenu_->IsShown()) menu = resultsMenu_;
    if (menu != nullptr && menu->GetItemCount() > 0)
        plan.AddWindow(menu->GetSelectedControl());
    return plan;
}
}
