#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialSectionPresenter.h"

#include <span>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialProfileMapper.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace lila::modules::social::presentation
{
namespace
{
using Mode = SocialNavigationState::ProfileEditorMode;

struct ProfileViewState final
{
    wxString title;
    wxString info;
    wxString bio;
    wxString victoryMessage;
    wxString defeatMessage;
    int visibilitySelection = 0;
    bool showProfileMenu = false;
    bool showSaveButton = false;
    bool enableSaveButton = false;
    wxString saveButtonLabel;
};

void ApplyProfileViewState(SocialView& view, const ProfileViewState& state)
{
    view.profileTitleLabel->SetLabel(state.title);
    view.profileInfoCtrl->SetValue(state.info);
    view.profileBioCtrl->SetValue(state.bio);
    view.profileVictoryCtrl->SetValue(state.victoryMessage);
    view.profileDefeatCtrl->SetValue(state.defeatMessage);
    view.profileVisibilityChoice->SetSelection(state.visibilitySelection);
    view.profileMenu->Show(state.showProfileMenu);
    view.profileSaveButton->SetLabel(state.saveButtonLabel);
    view.profileSaveButton->Show(state.showSaveButton);
    view.profileSaveButton->Enable(state.enableSaveButton);
}

wxString ResolveSaveButtonLabel(Mode mode)
{
    const char* label = lila::shared::text::ui::SocialProfileSave.data();
    switch (mode)
    {
    case Mode::Bio:
        label = lila::shared::text::ui::SocialProfileSaveBio.data();
        break;
    case Mode::VictoryMessage:
    case Mode::DefeatMessage:
        label = lila::shared::text::ui::SocialProfileSaveMessage.data();
        break;
    case Mode::Visibility:
        label = lila::shared::text::ui::SocialProfileSaveVisibility.data();
        break;
    case Mode::Menu:
        break;
    }

    return lila::shared::text::FromUtf8(label);
}

ProfileViewState BuildEmptyProfileViewState()
{
    return ProfileViewState{
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileTitle),
        wxEmptyString,
        wxEmptyString,
        wxEmptyString,
        wxEmptyString,
        0,
        false,
        false,
        false,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileSave)};
}

ProfileViewState BuildProfileViewState(
    const domain::SocialProfile& profile,
    Mode mode)
{
    const bool canEdit = profile.isOwner && mode != Mode::Menu;
    return ProfileViewState{
        profile.isOwner
            ? lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuProfile)
            : lila::shared::text::FromUtf8(profile.user.username),
        SocialPresentationModel::BuildProfileInfoText(profile),
        lila::shared::text::FromUtf8(profile.bio),
        lila::shared::text::FromUtf8(profile.victoryMessage),
        lila::shared::text::FromUtf8(profile.defeatMessage),
        SocialProfileMapper::ChoiceIndexFromVisibility(profile.visibility),
        true,
        canEdit,
        canEdit,
        ResolveSaveButtonLabel(mode)};
}

void SyncProfileMenuItems(SocialView& view, bool isOwner)
{
    static const lila::shared::ui::navigation::MenuBlueprintItem OwnerItems[] = {
        {"bio", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileEditBio), wxEmptyString},
        {"victory", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileEditVictory), wxEmptyString},
        {"defeat", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileEditDefeat), wxEmptyString},
        {"visibility", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileEditVisibility), wxEmptyString},
        {"storybook", wxString(L"Livre des contes"), wxEmptyString},
    };
    static const lila::shared::ui::navigation::MenuBlueprintItem VisitorItems[] = {
        {"storybook", wxString(L"Livre des contes"), wxEmptyString},
    };

    view.profileMenu->SetItems(
        isOwner
            ? lila::shared::ui::navigation::BuildMenuItems(std::span(OwnerItems))
            : lila::shared::ui::navigation::BuildMenuItems(std::span(VisitorItems)));
    view.profileMenu->SetSelectedIndexSilently(0);
}
}

void SocialSectionPresenter::SyncProfileEditorVisibility()
{
    view_.profileEditorMenuPanel->Show(navigationState_.profileEditorMode == Mode::Menu);
    view_.profileBioEditorPanel->Show(navigationState_.profileEditorMode == Mode::Bio);
    view_.profileVictoryEditorPanel->Show(navigationState_.profileEditorMode == Mode::VictoryMessage);
    view_.profileDefeatEditorPanel->Show(navigationState_.profileEditorMode == Mode::DefeatMessage);
    view_.profileVisibilityEditorPanel->Show(navigationState_.profileEditorMode == Mode::Visibility);
    view_.profilePanel->Layout();
}

void SocialSectionPresenter::SyncProfileControls()
{
    const auto& currentProfile = dataStore_.Profile();
    if (!currentProfile.has_value())
    {
        ApplyProfileViewState(view_, BuildEmptyProfileViewState());
        SyncProfileEditorVisibility();
        return;
    }

    SyncProfileMenuItems(view_, currentProfile->isOwner);
    ApplyProfileViewState(view_, BuildProfileViewState(*currentProfile, navigationState_.profileEditorMode));
    view_.profileCancelButton->Enable(true);
    SyncProfileEditorVisibility();
    view_.profilePanel->Layout();
}
}
