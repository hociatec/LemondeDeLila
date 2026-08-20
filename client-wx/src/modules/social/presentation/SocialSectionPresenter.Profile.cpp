#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialSectionPresenter.h"

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialProfileMapper.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
void SocialSectionPresenter::SyncProfileEditorVisibility()
{
    using Mode = SocialNavigationState::ProfileEditorMode;
    view_.profileEditorMenuPanel->Show(navigationState_.profileEditorMode == Mode::Menu);
    view_.profileBioEditorPanel->Show(navigationState_.profileEditorMode == Mode::Bio);
    view_.profileVictoryEditorPanel->Show(navigationState_.profileEditorMode == Mode::VictoryMessage);
    view_.profileDefeatEditorPanel->Show(navigationState_.profileEditorMode == Mode::DefeatMessage);
    view_.profileVisibilityEditorPanel->Show(navigationState_.profileEditorMode == Mode::Visibility);
    view_.profilePanel->Layout();
}

void SocialSectionPresenter::SyncProfileControls()
{
    using Mode = SocialNavigationState::ProfileEditorMode;
    const auto& currentProfile = dataStore_.Profile();
    if (!currentProfile.has_value())
    {
        view_.profileTitleLabel->SetLabel(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileTitle));
        view_.profileInfoCtrl->SetValue(wxEmptyString);
        view_.profileBioCtrl->SetValue(wxEmptyString);
        view_.profileVictoryCtrl->SetValue(wxEmptyString);
        view_.profileDefeatCtrl->SetValue(wxEmptyString);
        view_.profileVisibilityChoice->SetSelection(0);
        view_.profileMenu->Show(false);
        view_.profileSaveButton->SetLabel(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileSave));
        view_.profileSaveButton->Show(false);
        view_.profileSaveButton->Enable(false);
        SyncProfileEditorVisibility();
        return;
    }

    const auto& profile = *currentProfile;
    view_.profileTitleLabel->SetLabel(profile.isOwner
        ? lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuProfile)
        : lila::shared::text::FromUtf8(profile.user.username));
    view_.profileInfoCtrl->SetValue(SocialPresentationModel::BuildProfileInfoText(profile));
    view_.profileBioCtrl->SetValue(lila::shared::text::FromUtf8(profile.bio));
    view_.profileVictoryCtrl->SetValue(lila::shared::text::FromUtf8(profile.victoryMessage));
    view_.profileDefeatCtrl->SetValue(lila::shared::text::FromUtf8(profile.defeatMessage));
    view_.profileVisibilityChoice->SetSelection(SocialProfileMapper::ChoiceIndexFromVisibility(profile.visibility));
    view_.profileMenu->Show(profile.isOwner);

    if (!profile.isOwner || navigationState_.profileEditorMode == Mode::Menu)
    {
        view_.profileSaveButton->SetLabel(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileSave));
        view_.profileSaveButton->Show(false);
        view_.profileSaveButton->Enable(false);
    }
    else
    {
        const char* label = lila::shared::text::ui::SocialProfileSave.data();
        switch (navigationState_.profileEditorMode)
        {
        case Mode::Bio: label = lila::shared::text::ui::SocialProfileSaveBio.data(); break;
        case Mode::VictoryMessage:
        case Mode::DefeatMessage: label = lila::shared::text::ui::SocialProfileSaveMessage.data(); break;
        case Mode::Visibility: label = lila::shared::text::ui::SocialProfileSaveVisibility.data(); break;
        case Mode::Menu: break;
        }
        view_.profileSaveButton->SetLabel(lila::shared::text::FromUtf8(label));
        view_.profileSaveButton->Show(true);
        view_.profileSaveButton->Enable(true);
    }

    view_.profileCancelButton->Enable(true);
    SyncProfileEditorVisibility();
    view_.profilePanel->Layout();
}
}
