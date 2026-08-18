#include "shared/text/Encoding.h"
void SocialView::BuildProfileSection(wxWindow* parent)
{
    profilePanel = new wxPanel(parent);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    profileTitleLabel = new wxStaticText(profilePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuProfile));
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
        {"bio", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileEditBio), wxEmptyString},
        {"victory", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileEditVictory), wxEmptyString},
        {"defeat", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileEditDefeat), wxEmptyString},
        {"visibility", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileEditVisibility), wxEmptyString},
    }};
    profileMenu = new lila::shared::ui::controls::VerticalMenu(
        profileEditorMenuPanel,
        lila::shared::ui::navigation::BuildMenuItems(ProfileMenuItems));
    menuPanelSizer->Add(profileMenu, 1, wxEXPAND);
    profileEditorMenuPanel->SetSizer(menuPanelSizer);

    profileBioEditorPanel = new wxPanel(editorHost);
    auto* bioSizer = new wxBoxSizer(wxVERTICAL);
    bioSizer->Add(new wxStaticText(profileBioEditorPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileBioLabel)), 0, wxBOTTOM, 8);
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
    victorySizer->Add(new wxStaticText(profileVictoryEditorPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVictoryLabel)), 0, wxBOTTOM, 8);
    profileVictoryCtrl = new wxTextCtrl(profileVictoryEditorPanel, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_TAB);
    victorySizer->Add(profileVictoryCtrl, 0, wxEXPAND);
    profileVictoryEditorPanel->SetSizer(victorySizer);

    profileDefeatEditorPanel = new wxPanel(editorHost);
    auto* defeatSizer = new wxBoxSizer(wxVERTICAL);
    defeatSizer->Add(new wxStaticText(profileDefeatEditorPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileDefeatLabel)), 0, wxBOTTOM, 8);
    profileDefeatCtrl = new wxTextCtrl(profileDefeatEditorPanel, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_TAB);
    defeatSizer->Add(profileDefeatCtrl, 0, wxEXPAND);
    profileDefeatEditorPanel->SetSizer(defeatSizer);

    profileVisibilityEditorPanel = new wxPanel(editorHost);
    auto* visibilitySizer = new wxBoxSizer(wxVERTICAL);
    visibilitySizer->Add(new wxStaticText(profileVisibilityEditorPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVisibilityLabel)), 0, wxBOTTOM, 8);
    profileVisibilityChoice = new wxChoice(profileVisibilityEditorPanel, wxID_ANY);
    profileVisibilityChoice->Append(lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVisibilityChoicePublic), reinterpret_cast<void*>(0));
    profileVisibilityChoice->Append(lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVisibilityChoiceFriends), reinterpret_cast<void*>(1));
    profileVisibilityChoice->Append(lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVisibilityChoicePrivate), reinterpret_cast<void*>(2));
    visibilitySizer->Add(profileVisibilityChoice, 0, wxEXPAND);
    profileVisibilityEditorPanel->SetSizer(visibilitySizer);

    editorHostSizer->Add(profileEditorMenuPanel, 1, wxEXPAND);
    editorHostSizer->Add(profileBioEditorPanel, 1, wxEXPAND);
    editorHostSizer->Add(profileVictoryEditorPanel, 1, wxEXPAND);
    editorHostSizer->Add(profileDefeatEditorPanel, 1, wxEXPAND);
    editorHostSizer->Add(profileVisibilityEditorPanel, 1, wxEXPAND);
    editorHost->SetSizer(editorHostSizer);

    auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
    profileSaveButton = new wxButton(profilePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileSave));
    profileCancelButton = new wxButton(profilePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileCancel));
    buttonSizer->Add(profileSaveButton, 0, wxRIGHT, 10);
    buttonSizer->Add(profileCancelButton, 0);

    rootSizer->Add(profileTitleLabel, 0, wxBOTTOM, 10);
    rootSizer->Add(profileInfoCtrl, 0, wxEXPAND | wxBOTTOM, 12);
    rootSizer->Add(editorHost, 1, wxEXPAND | wxBOTTOM, 12);
    rootSizer->Add(buttonSizer, 0, wxALIGN_LEFT);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileTitleLabel, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileTitle));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileInfoCtrl, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileDetails));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileBioCtrl, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileBioLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileVictoryCtrl, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVictoryLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileDefeatCtrl, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileDefeatLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileVisibilityChoice, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVisibilityLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileSaveButton, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileSave));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileCancelButton, lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileCancel));
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

