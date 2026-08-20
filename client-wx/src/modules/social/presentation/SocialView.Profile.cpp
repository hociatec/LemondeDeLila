#include "modules/social/presentation/SocialView.h"

#include "shared/text/Encoding.h"

#include <array>
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace lila::modules::social::presentation
{
void SocialView::BuildProfileSection(wxWindow* parent)
{
    profilePanel = new wxPanel(parent);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    profileTitleLabel = new wxStaticText(profilePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuProfile));
    profileInfoCtrl = new wxTextCtrl(
        profilePanel,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2);
    profileInfoCtrl->SetMinSize(wxSize(-1, 210));

    auto* editorHost = new wxPanel(profilePanel);
    auto* editorHostSizer = new wxBoxSizer(wxVERTICAL);

    profileEditorMenuPanel = new wxPanel(editorHost);
    auto* menuPanelSizer = new wxBoxSizer(wxVERTICAL);
    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 4> ProfileMenuItems = {{
        {"bio", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileEditBio), wxEmptyString},
        {"victory", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileEditVictory), wxEmptyString},
        {"defeat", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileEditDefeat), wxEmptyString},
        {"visibility", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileEditVisibility), wxEmptyString},
    }};
    profileMenu = new lila::shared::ui::controls::VerticalMenu(
        profileEditorMenuPanel,
        lila::shared::ui::navigation::BuildMenuItems(ProfileMenuItems));
    menuPanelSizer->Add(profileMenu, 1, wxEXPAND);
    profileEditorMenuPanel->SetSizer(menuPanelSizer);

    profileBioEditorPanel = new wxPanel(editorHost);
    auto* bioSizer = new wxBoxSizer(wxVERTICAL);
    bioSizer->Add(new wxStaticText(profileBioEditorPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileBioLabel)), 0, wxBOTTOM, 8);
    profileBioCtrl = new wxTextCtrl(
        profileBioEditorPanel,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_RICH2 | wxTE_PROCESS_TAB);
    profileBioCtrl->SetMinSize(wxSize(-1, 180));
    bioSizer->Add(profileBioCtrl, 1, wxEXPAND);
    profileBioEditorPanel->SetSizer(bioSizer);

    profileVictoryEditorPanel = new wxPanel(editorHost);
    auto* victorySizer = new wxBoxSizer(wxVERTICAL);
    victorySizer->Add(new wxStaticText(profileVictoryEditorPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVictoryLabel)), 0, wxBOTTOM, 8);
    profileVictoryCtrl = new wxTextCtrl(profileVictoryEditorPanel, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_TAB);
    victorySizer->Add(profileVictoryCtrl, 0, wxEXPAND);
    profileVictoryEditorPanel->SetSizer(victorySizer);

    profileDefeatEditorPanel = new wxPanel(editorHost);
    auto* defeatSizer = new wxBoxSizer(wxVERTICAL);
    defeatSizer->Add(new wxStaticText(profileDefeatEditorPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileDefeatLabel)), 0, wxBOTTOM, 8);
    profileDefeatCtrl = new wxTextCtrl(profileDefeatEditorPanel, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_TAB);
    defeatSizer->Add(profileDefeatCtrl, 0, wxEXPAND);
    profileDefeatEditorPanel->SetSizer(defeatSizer);

    profileVisibilityEditorPanel = new wxPanel(editorHost);
    auto* visibilitySizer = new wxBoxSizer(wxVERTICAL);
    visibilitySizer->Add(new wxStaticText(profileVisibilityEditorPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVisibilityLabel)), 0, wxBOTTOM, 8);
    profileVisibilityChoice = new wxChoice(profileVisibilityEditorPanel, wxID_ANY);
    profileVisibilityChoice->Append(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVisibilityChoicePublic));
    profileVisibilityChoice->Append(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVisibilityChoiceFriends));
    profileVisibilityChoice->Append(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVisibilityChoicePrivate));
    visibilitySizer->Add(profileVisibilityChoice, 0, wxEXPAND);
    profileVisibilityEditorPanel->SetSizer(visibilitySizer);

    editorHostSizer->Add(profileEditorMenuPanel, 1, wxEXPAND);
    editorHostSizer->Add(profileBioEditorPanel, 1, wxEXPAND);
    editorHostSizer->Add(profileVictoryEditorPanel, 1, wxEXPAND);
    editorHostSizer->Add(profileDefeatEditorPanel, 1, wxEXPAND);
    editorHostSizer->Add(profileVisibilityEditorPanel, 1, wxEXPAND);
    editorHost->SetSizer(editorHostSizer);

    auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
    profileSaveButton = new wxButton(profilePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileSave));
    profileCancelButton = new wxButton(profilePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileCancel));
    buttonSizer->Add(profileSaveButton, 0, wxRIGHT, 10);
    buttonSizer->Add(profileCancelButton, 0);

    rootSizer->Add(profileTitleLabel, 0, wxBOTTOM, 10);
    rootSizer->Add(profileInfoCtrl, 0, wxEXPAND | wxBOTTOM, 12);
    rootSizer->Add(editorHost, 1, wxEXPAND | wxBOTTOM, 12);
    rootSizer->Add(buttonSizer, 0, wxALIGN_LEFT);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileTitleLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileTitle));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileInfoCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileDetails));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileBioCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileBioLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileVictoryCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVictoryLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileDefeatCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileDefeatLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileVisibilityChoice, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVisibilityLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileSaveButton, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileSave));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileCancelButton, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileCancel));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {
            profileInfoCtrl,
            profileMenu,
            profileBioCtrl,
            profileVictoryCtrl,
            profileDefeatCtrl,
            profileVisibilityChoice,
            profileSaveButton,
            profileCancelButton});
    profilePanel->SetSizer(rootSizer);
}
}
