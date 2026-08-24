#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialSectionCoordinator.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"

#include <wx/stattext.h>
#include <wx/choice.h>
#include <wx/textctrl.h>

#include "shared/accessibility/application/FocusManager.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
using FocusManager = lila::shared::accessibility::FocusManager;
using Navigator = lila::shared::accessibility::NavigationController;
}

void SocialFrame::SyncPanels()
{
    const auto shell = view_->Shell();
    if (shell.sectionBook == nullptr)
    {
        return;
    }

    const bool showSections = navigationState_.currentScreen == Screen::Section;
    shell.sectionBook->Show(showSections);

    if (showSections)
    {
        sectionPresenter_->ShowCurrentSection();
        if (navigationState_.currentSection == SocialSection::Profile)
        {
            sectionPresenter_->SyncProfileControls();
        }
        else
        {
            sectionPresenter_->SyncSelectionState();
        }
    }

    shell.sectionBook->Layout();
    view_->Layout();
    Layout();
}

void SocialFrame::UpdateStatus(const wxString& message, bool isError, bool announce)
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
    if (announce)
    {
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*shell.statusLabel, message);
    }
    else
    {
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
            *shell.statusLabel,
            wxString(L"État"),
            wxString(L"État"));
    }
}

void SocialFrame::RefreshCurrentSection()
{
    sectionCoordinator_->RefreshCurrentSection();
}

void SocialFrame::RefreshSection(SocialSection section)
{
    sectionCoordinator_->RefreshSection(section);
}

void SocialFrame::ScheduleFocusCurrentScreen()
{
    lila::shared::accessibility::FocusCoordinator::Schedule(
        *this,
        [this]()
        {
            return BuildFocusPlan();
        });
}

Navigator::Scope SocialFrame::BuildFocusScope() const
{
    const auto profile = view_->Profile();
    Navigator::Scope scope;

    if (navigationState_.currentScreen == Screen::Menu)
    {
        scope.Add([this]() { return view_->menu != nullptr ? view_->menu->GetSelectedControl() : nullptr; });
        return scope;
    }

    if (navigationState_.currentSection != SocialSection::Profile)
    {
        const auto controls = view_->SectionFor(navigationState_.currentSection);
        scope.Add([controls] { return controls.list != nullptr && controls.list->GetItemCount() > 0 ? controls.list->GetFirstButton() : controls.emptyControl; });
        if (navigationState_.sectionActionMenuActive)
        {
            scope.Add([controls]() -> wxWindow* { return controls.actionsMenu != nullptr ? controls.actionsMenu->GetFirstButton() : nullptr; });
        }
        return scope;
    }

    switch (navigationState_.profileEditorMode)
    {
    case ProfileEditorMode::Menu:
        scope.Add([profile]() -> wxWindow*
        {
            if (profile.profileMenu != nullptr && profile.profileMenu->IsShown())
            {
                return profile.profileMenu->GetSelectedControl();
            }

            return profile.profileInfoCtrl;
        }).Add(profile.profileCancelButton);
        break;
    case ProfileEditorMode::Bio:
        scope.Add({profile.profileBioCtrl, profile.profileSaveButton, profile.profileCancelButton});
        break;
    case ProfileEditorMode::VictoryMessage:
        scope.Add({profile.profileVictoryCtrl, profile.profileSaveButton, profile.profileCancelButton});
        break;
    case ProfileEditorMode::DefeatMessage:
        scope.Add({profile.profileDefeatCtrl, profile.profileSaveButton, profile.profileCancelButton});
        break;
    case ProfileEditorMode::Visibility:
        scope.Add({profile.profileVisibilityChoice, profile.profileSaveButton, profile.profileCancelButton});
        break;
    }

    return scope;
}

bool SocialFrame::IsExplicitTabNavigationContext() const noexcept
{
    return navigationState_.currentScreen == Screen::Section &&
           navigationState_.currentSection == SocialSection::Profile &&
           navigationState_.profileEditorMode != ProfileEditorMode::Menu;
}

wxWindow* SocialFrame::ResolveMenuFocusTarget()
{
    const auto shell = view_->Shell();
    if (shell.menu == nullptr || shell.menu->GetItemCount() == 0)
    {
        return nullptr;
    }

    if (navigationState_.lastMenuIndex >= shell.menu->GetItemCount())
    {
        navigationState_.lastMenuIndex = 0;
    }

    shell.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
    return shell.menu->GetSelectedControl();
}

wxWindow* SocialFrame::ResolveCurrentSectionTarget()
{
    const auto controls = view_->SectionFor(navigationState_.currentSection);
    if (controls.list == nullptr)
    {
        return controls.emptyControl;
    }

    if (controls.list->GetItemCount() == 0)
    {
        return controls.emptyControl;
    }

    if (controls.list->GetSelectedIndex() >= controls.list->GetItemCount())
    {
        controls.list->SetSelectedIndexSilently(0);
        sectionPresenter_->SyncSelectionState();
    }

    return controls.list->GetFirstButton();
}
}
