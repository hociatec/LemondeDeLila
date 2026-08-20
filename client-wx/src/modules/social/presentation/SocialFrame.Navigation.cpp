#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialSectionCoordinator.h"
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
    sectionCoordinator_->ActivateSection(section);
}

void SocialFrame::ApplyNavigationState()
{
    if (navigationState_.currentScreen == Screen::Menu)
    {
        SetScreen(Screen::Menu);
        return;
    }

    if (view_->menu != nullptr)
    {
        view_->menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
    }

    sectionPresenter_->ShowCurrentSection();
    if (navigationState_.currentSection == SocialSection::Profile)
    {
        sectionPresenter_->SyncProfileControls();
    }
    else
    {
        sectionPresenter_->SyncSelectionState();
    }

    focusController_->FocusCurrentScreen();
}

void SocialFrame::OpenCurrentSectionActionMenu()
{
    if (navigationState_.currentScreen != Screen::Section ||
        navigationState_.currentSection == SocialSection::Profile)
    {
        return;
    }

    navigationState_.sectionActionMenuActive = true;
    sectionPresenter_->SyncSelectionState();
    focusController_->FocusCurrentScreen();
}

void SocialFrame::CloseCurrentSectionActionMenu()
{
    if (!navigationState_.sectionActionMenuActive)
    {
        return;
    }

    navigationState_.sectionActionMenuActive = false;
    sectionPresenter_->SyncSelectionState();
    focusController_->FocusCurrentScreen();
}

void SocialFrame::UpdateStatus(const wxString& message, bool isError)
{
    const auto shell = view_->Shell();
    if (shell.statusLabel == nullptr)
    {
        return;
    }

    shell.statusLabel->SetLabel(message);
    shell.statusLabel->SetForegroundColour(isError ? wxColour(255, 170, 170) : lila::shared::ui::Theme::Accent());
    shell.statusLabel->Wrap(GetClientSize().GetWidth() - 80);
    shell.statusLabel->GetParent()->Layout();
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*shell.statusLabel, message);
}

void SocialFrame::RefreshCurrentSection()
{
    sectionCoordinator_->RefreshCurrentSection();
}

void SocialFrame::RefreshSection(SocialSection section)
{
    sectionCoordinator_->RefreshSection(section);
}
}
