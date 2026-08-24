#include "modules/social/presentation/SocialProfileCoordinator.h"

#include <optional>
#include <utility>

#include <wx/choice.h>
#include <wx/textctrl.h>

#include "modules/social/presentation/SocialActionController.h"
#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialProfileMapper.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/text/Encoding.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
SocialProfileCoordinator::SocialProfileCoordinator(
    SocialNavigationState& navigationState,
    SocialDataStore& dataStore,
    SocialSectionPresenter& sectionPresenter,
    SocialView& view,
    SocialActionController& actionController,
    Callbacks callbacks) noexcept
    : navigationState_(navigationState),
      dataStore_(dataStore),
      sectionPresenter_(sectionPresenter),
      view_(view),
      actionController_(actionController),
      callbacks_(std::move(callbacks))
{
}

void SocialProfileCoordinator::ActivateSelectedAction()
{
    if (!dataStore_.Profile().has_value())
    {
        return;
    }

    const auto selectedAction = view_.Profile().profileMenu->GetSelectedItemId();
    if (!selectedAction.has_value())
    {
        return;
    }

    const auto actionId = ParseSocialActionId(*selectedAction);
    if (!actionId.has_value())
    {
        return;
    }

    const auto& profile = *dataStore_.Profile();
    if (*actionId == SocialActionId::OpenStoryBook)
    {
        if (callbacks_.openStoryBook)
        {
            callbacks_.openStoryBook(profile.user.id.value, profile.user.username);
        }
        return;
    }
    if (!profile.isOwner)
    {
        return;
    }

    switch (*actionId)
    {
    case SocialActionId::EditBio:
        StartEdit(ProfileEditorMode::Bio);
        return;
    case SocialActionId::EditVictoryMessage:
        StartEdit(ProfileEditorMode::VictoryMessage);
        return;
    case SocialActionId::EditDefeatMessage:
        StartEdit(ProfileEditorMode::DefeatMessage);
        return;
    case SocialActionId::EditVisibility:
        StartEdit(ProfileEditorMode::Visibility);
        return;
    case SocialActionId::OpenStoryBook:
        return;
    default:
        return;
    }
}

void SocialProfileCoordinator::StartEdit(ProfileEditorMode mode)
{
    navigationState_.PushCurrent();
    navigationState_.profileEditorMode = mode;
    sectionPresenter_.SyncProfileControls();
    callbacks_.scheduleFocusCurrentScreen();
}

void SocialProfileCoordinator::SaveProfile()
{
    const auto& currentProfile = dataStore_.Profile();
    if (!currentProfile.has_value() || !currentProfile->isOwner)
    {
        callbacks_.updateStatus(
            lila::shared::text::FromUtf8(lila::shared::text::ui::SocialOnlyOwnProfileEditable),
            true);
        return;
    }

    const auto profile = view_.Profile();
    const domain::SocialProfileUpdate update = SocialProfileMapper::BuildUpdate(
        lila::shared::text::ToUtf8(profile.profileBioCtrl->GetValue()),
        lila::shared::text::ToUtf8(profile.profileVictoryCtrl->GetValue()),
        lila::shared::text::ToUtf8(profile.profileDefeatCtrl->GetValue()),
        profile.profileVisibilityChoice->GetSelection());

    actionController_.SaveProfile(
        update,
        [this](std::optional<domain::SocialProfile> savedProfile)
        {
            dataStore_.ReplaceProfile(std::move(savedProfile));
            navigationState_.profileEditorMode = ProfileEditorMode::Menu;
            sectionPresenter_.SyncProfileControls();
            callbacks_.showFeedback(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileUpdated));
            if (navigationState_.currentSection == SocialSection::Profile)
            {
                callbacks_.scheduleFocusCurrentScreen();
            }
        });
}
}
