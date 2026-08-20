#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialActionController.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialProfileMapper.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"

#include <utility>

#include <wx/choice.h>
#include <wx/textctrl.h>

#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
void SocialFrame::OpenProfile(int userId)
{
    navigationState_.RememberProfileReturnSection();
    LoadProfile(userId);
    SetSection(SocialSection::Profile);
}

void SocialFrame::SaveProfile()
{
    const auto& currentProfile = dataStore_.Profile();
    if (!currentProfile.has_value() || !currentProfile->isOwner)
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialOnlyOwnProfileEditable), true);
        return;
    }

    const domain::SocialProfileUpdate update = SocialProfileMapper::BuildUpdate(
        lila::shared::text::ToUtf8(view_->profileBioCtrl->GetValue()),
        lila::shared::text::ToUtf8(view_->profileVictoryCtrl->GetValue()),
        lila::shared::text::ToUtf8(view_->profileDefeatCtrl->GetValue()),
        view_->profileVisibilityChoice->GetSelection());

    actionController_->SaveProfile(
        update,
        [this](std::optional<domain::SocialProfile> savedProfile)
        {
            dataStore_.ReplaceProfile(std::move(savedProfile));
            navigationState_.profileEditorMode = ProfileEditorMode::Menu;
            sectionPresenter_->SyncProfileControls();
            ShowActionFeedback(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileUpdated));
            if (navigationState_.currentSection == SocialSection::Profile)
            {
                focusController_->FocusCurrentScreen();
            }
        });
}

void SocialFrame::StartProfileEdit(ProfileEditorMode mode)
{
    navigationState_.profileEditorMode = mode;
    sectionPresenter_->SyncProfileControls();
    focusController_->FocusCurrentScreen();
}

void SocialFrame::ExitProfileEditMode()
{
    navigationState_.profileEditorMode = ProfileEditorMode::Menu;
    sectionPresenter_->SyncProfileEditorVisibility();
    if (view_->profileMenu != nullptr)
    {
        view_->profileMenu->FocusSelectedItem();
    }
    sectionPresenter_->SyncProfileControls();
}

bool SocialFrame::TryExitProfile()
{
    if (navigationState_.profileEditorMode != ProfileEditorMode::Menu)
    {
        ExitProfileEditMode();
        return true;
    }

    if (navigationState_.returnSectionFromProfile.has_value())
    {
        const SocialSection section = *navigationState_.returnSectionFromProfile;
        navigationState_.returnSectionFromProfile.reset();
        navigationState_.profileTargetUserId.reset();
        SetSection(section);
        return true;
    }

    return false;
}
}
