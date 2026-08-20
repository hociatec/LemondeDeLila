#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"

#include <wx/stattext.h>

#include "shared/ui/Theme.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
void SocialFrame::SetSection(SocialSection section)
{
    if (section != navigationState_.currentSection)
    {
        sectionPresenter_->StoreSelection(navigationState_.currentSection);
    }

    navigationState_.EnterSection(section, SocialPresentationModel::SectionToMenuIndex(section));
    if (view_->menu != nullptr)
    {
        view_->menu->SetSelectedIndex(navigationState_.lastMenuIndex);
    }

    switch (section)
    {
    case SocialSection::Friends:
        LoadFriends();
        break;
    case SocialSection::IncomingRequests:
        LoadIncomingRequests();
        break;
    case SocialSection::OutgoingRequests:
        LoadOutgoingRequests();
        break;
    case SocialSection::Blocked:
        LoadBlockedUsers();
        break;
    case SocialSection::Profile:
        sectionPresenter_->ShowCurrentSection();
        sectionPresenter_->SyncProfileControls();
        break;
    }
}

void SocialFrame::UpdateStatus(const wxString& message, bool isError)
{
    if (view_->statusLabel == nullptr)
    {
        return;
    }

    view_->statusLabel->SetLabel(message);
    view_->statusLabel->SetForegroundColour(isError ? wxColour(255, 170, 170) : lila::shared::ui::Theme::Accent());
    view_->statusLabel->Wrap(GetClientSize().GetWidth() - 80);
    view_->statusLabel->GetParent()->Layout();
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*view_->statusLabel, message);
}

void SocialFrame::RefreshCurrentSection()
{
    if (navigationState_.currentScreen == Screen::Section)
    {
        RefreshSection(navigationState_.currentSection);
    }
}

void SocialFrame::RefreshSection(SocialSection section)
{
    switch (section)
    {
    case SocialSection::Friends:
        LoadFriends();
        return;
    case SocialSection::IncomingRequests:
        LoadIncomingRequests();
        return;
    case SocialSection::OutgoingRequests:
        LoadOutgoingRequests();
        return;
    case SocialSection::Blocked:
        LoadBlockedUsers();
        return;
    case SocialSection::Profile:
        LoadProfile(navigationState_.profileTargetUserId);
        return;
    }
}
}
