#include "modules/social/presentation/SocialFrame.h"

#include <array>
#include <span>

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace lila::modules::social::presentation
{
void SocialFrame::BuildLayout()
{
    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(headerPanel, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialSocialHeader));
    subtitleLabel_ = new wxStaticText(headerPanel, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialSocialSubtitle));
    headerSizer->Add(titleLabel_, 0, wxBOTTOM, 6);
    headerSizer->Add(subtitleLabel_, 0);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel_, wxString::FromUTF8(lila::shared::errors::SocialSocialHeader));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subtitleLabel_, wxString::FromUTF8(lila::shared::errors::SocialSocialSubtitle));
    headerPanel->SetSizer(headerSizer);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* contentSizer = new wxBoxSizer(wxHORIZONTAL);

    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 6> MenuItems = {{
        {"messaging", wxString::FromUTF8(lila::shared::errors::SocialMenuMessaging), wxEmptyString},
        {"friends", wxString::FromUTF8(lila::shared::errors::SocialMenuFriends), wxEmptyString},
        {"incoming", wxString::FromUTF8(lila::shared::errors::SocialMenuIncomingRequests), wxEmptyString},
        {"outgoing", wxString::FromUTF8(lila::shared::errors::SocialMenuOutgoingRequests), wxEmptyString},
        {"blocked", wxString::FromUTF8(lila::shared::errors::SocialMenuBlocked), wxEmptyString},
        {"profile", wxString::FromUTF8(lila::shared::errors::SocialMenuProfile), wxEmptyString},
    }};

    menu_ = new lila::shared::ui::controls::VerticalMenu(
        contentPanel,
        lila::shared::ui::navigation::BuildMenuItems(MenuItems));
    menu_->SetMinSize(wxSize(260, -1));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*menu_, wxString::FromUTF8(lila::shared::errors::SocialNavigationMenuAccessible));

    sectionBook_ = new wxSimplebook(contentPanel, wxID_ANY);
    BuildFriendsSection(sectionBook_);
    BuildIncomingRequestsSection(sectionBook_);
    BuildOutgoingRequestsSection(sectionBook_);
    BuildBlockedSection(sectionBook_);
    BuildProfileSection(sectionBook_);
    sectionBook_->AddPage(friendsPanel_, wxString::FromUTF8(lila::shared::errors::SocialMenuFriends));
    sectionBook_->AddPage(incomingRequestsPanel_, wxString::FromUTF8(lila::shared::errors::SocialMenuIncomingRequests));
    sectionBook_->AddPage(outgoingRequestsPanel_, wxString::FromUTF8(lila::shared::errors::SocialMenuOutgoingRequests));
    sectionBook_->AddPage(blockedPanel_, wxString::FromUTF8(lila::shared::errors::SocialMenuBlocked));
    sectionBook_->AddPage(profilePanel_, wxString::FromUTF8(lila::shared::errors::SocialMenuProfile));

    contentSizer->Add(menu_, 0, wxEXPAND | wxRIGHT, 20);
    contentSizer->Add(sectionBook_, 1, wxEXPAND);
    contentPanel->SetSizer(contentSizer);

    auto* footerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* footerSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel_ = new wxStaticText(footerPanel, wxID_ANY, wxEmptyString);
    footerSizer->Add(statusLabel_, 1, wxALIGN_CENTER_VERTICAL);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel_, wxString::FromUTF8(lila::shared::errors::SocialSocialStateAccessible));
    footerPanel->SetSizer(footerSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(contentPanel, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(footerPanel, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 20);
    root->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(root, 1, wxEXPAND);
    SetSizer(frameSizer);
}

void SocialFrame::BuildFriendsSection(wxWindow* parent)
{
    friendsPanel_ = new wxPanel(parent);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(friendsPanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialSectionFriends));
    friendsList_ = new lila::shared::ui::controls::VerticalMenu(friendsPanel_, {});
    friendsList_->SetMinSize(wxSize(260, -1));
    emptyFriendsCtrl_ = new wxTextCtrl(
        friendsPanel_,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::SocialNoFriend),
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    emptyFriendsCtrl_->SetMinSize(wxSize(-1, 80));

    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 3> FriendsActionItems = {{
        {"view-profile", wxString::FromUTF8(lila::shared::errors::SocialProfileActionView), wxEmptyString},
        {"remove-friend", wxString::FromUTF8(lila::shared::errors::SocialProfileActionRemoveFriend), wxEmptyString},
        {"block-friend", wxString::FromUTF8(lila::shared::errors::SocialProfileActionBlock), wxEmptyString},
    }};
    friendsActionsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        friendsPanel_,
        lila::shared::ui::navigation::BuildMenuItems(FriendsActionItems));
    friendsActionsMenu_->SetMinSize(wxSize(260, -1));

    sizer->Add(title, 0, wxBOTTOM, 10);
    sizer->Add(friendsList_, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(emptyFriendsCtrl_, 0, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(friendsActionsMenu_, 0, wxEXPAND);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*friendsList_, wxString::FromUTF8(lila::shared::errors::SocialSectionFriends));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*emptyFriendsCtrl_, wxString::FromUTF8(lila::shared::errors::SocialNoFriend));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*friendsActionsMenu_, wxString::FromUTF8(lila::shared::errors::SocialProfileActionMenuList));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {
            friendsList_,
            emptyFriendsCtrl_,
            friendsActionsMenu_ != nullptr ? static_cast<wxWindow*>(friendsActionsMenu_->GetFirstButton()) : nullptr});
    friendsPanel_->SetSizer(sizer);
}

void SocialFrame::BuildIncomingRequestsSection(wxWindow* parent)
{
    incomingRequestsPanel_ = new wxPanel(parent);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(incomingRequestsPanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialMenuIncomingRequests));
    incomingRequestsList_ = new lila::shared::ui::controls::VerticalMenu(incomingRequestsPanel_, {});
    incomingRequestsList_->SetMinSize(wxSize(260, -1));
    emptyIncomingRequestsCtrl_ = new wxTextCtrl(
        incomingRequestsPanel_,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::SocialNoIncomingRequest),
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    emptyIncomingRequestsCtrl_->SetMinSize(wxSize(-1, 80));

    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 4> IncomingActionItems = {{
        {"accept-request", wxString::FromUTF8(lila::shared::errors::SocialProfileActionAccept), wxEmptyString},
        {"reject-request", wxString::FromUTF8(lila::shared::errors::SocialProfileActionReject), wxEmptyString},
        {"view-profile", wxString::FromUTF8(lila::shared::errors::SocialProfileActionView), wxEmptyString},
        {"block-user", wxString::FromUTF8(lila::shared::errors::SocialProfileActionBlock), wxEmptyString},
    }};
    incomingActionsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        incomingRequestsPanel_,
        lila::shared::ui::navigation::BuildMenuItems(IncomingActionItems));
    incomingActionsMenu_->SetMinSize(wxSize(260, -1));

    sizer->Add(title, 0, wxBOTTOM, 10);
    sizer->Add(incomingRequestsList_, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(emptyIncomingRequestsCtrl_, 0, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(incomingActionsMenu_, 0, wxEXPAND);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*incomingRequestsList_, wxString::FromUTF8(lila::shared::errors::SocialMenuIncomingRequests));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*emptyIncomingRequestsCtrl_, wxString::FromUTF8(lila::shared::errors::SocialNoIncomingRequest));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*incomingActionsMenu_, wxString::FromUTF8(lila::shared::errors::SocialProfileActionIncomingList));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {
            incomingRequestsList_,
            emptyIncomingRequestsCtrl_,
            incomingActionsMenu_ != nullptr ? static_cast<wxWindow*>(incomingActionsMenu_->GetFirstButton()) : nullptr});
    incomingRequestsPanel_->SetSizer(sizer);
}

void SocialFrame::BuildOutgoingRequestsSection(wxWindow* parent)
{
    outgoingRequestsPanel_ = new wxPanel(parent);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(outgoingRequestsPanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialMenuOutgoingRequests));
    outgoingRequestsList_ = new lila::shared::ui::controls::VerticalMenu(outgoingRequestsPanel_, {});
    outgoingRequestsList_->SetMinSize(wxSize(260, -1));
    emptyOutgoingRequestsCtrl_ = new wxTextCtrl(
        outgoingRequestsPanel_,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::SocialNoOutgoingRequest),
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    emptyOutgoingRequestsCtrl_->SetMinSize(wxSize(-1, 80));

    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 3> OutgoingActionItems = {{
        {"cancel-request", wxString::FromUTF8(lila::shared::errors::SocialProfileActionCancel), wxEmptyString},
        {"view-profile", wxString::FromUTF8(lila::shared::errors::SocialProfileActionView), wxEmptyString},
        {"block-user", wxString::FromUTF8(lila::shared::errors::SocialProfileActionBlock), wxEmptyString},
    }};
    outgoingActionsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        outgoingRequestsPanel_,
        lila::shared::ui::navigation::BuildMenuItems(OutgoingActionItems));
    outgoingActionsMenu_->SetMinSize(wxSize(260, -1));

    sizer->Add(title, 0, wxBOTTOM, 10);
    sizer->Add(outgoingRequestsList_, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(emptyOutgoingRequestsCtrl_, 0, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(outgoingActionsMenu_, 0, wxEXPAND);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*outgoingRequestsList_, wxString::FromUTF8(lila::shared::errors::SocialMenuOutgoingRequests));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*emptyOutgoingRequestsCtrl_, wxString::FromUTF8(lila::shared::errors::SocialNoOutgoingRequest));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*outgoingActionsMenu_, wxString::FromUTF8(lila::shared::errors::SocialProfileActionOutgoingList));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {
            outgoingRequestsList_,
            emptyOutgoingRequestsCtrl_,
            outgoingActionsMenu_ != nullptr ? static_cast<wxWindow*>(outgoingActionsMenu_->GetFirstButton()) : nullptr});
    outgoingRequestsPanel_->SetSizer(sizer);
}

void SocialFrame::BuildBlockedSection(wxWindow* parent)
{
    blockedPanel_ = new wxPanel(parent);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(blockedPanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialMenuBlocked));
    blockedUsersList_ = new lila::shared::ui::controls::VerticalMenu(blockedPanel_, {});
    blockedUsersList_->SetMinSize(wxSize(260, -1));
    emptyBlockedUsersCtrl_ = new wxTextCtrl(
        blockedPanel_,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::SocialNoBlockedUser),
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    emptyBlockedUsersCtrl_->SetMinSize(wxSize(-1, 80));

    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 1> BlockedActionItems = {{
        {"unblock-user", wxString::FromUTF8(lila::shared::errors::SocialProfileActionUnblock), wxEmptyString},
    }};
    blockedActionsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        blockedPanel_,
        lila::shared::ui::navigation::BuildMenuItems(BlockedActionItems));
    blockedActionsMenu_->SetMinSize(wxSize(260, -1));

    sizer->Add(title, 0, wxBOTTOM, 10);
    sizer->Add(blockedUsersList_, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(emptyBlockedUsersCtrl_, 0, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(blockedActionsMenu_, 0, wxEXPAND);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*blockedUsersList_, wxString::FromUTF8(lila::shared::errors::SocialMenuBlocked));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*emptyBlockedUsersCtrl_, wxString::FromUTF8(lila::shared::errors::SocialNoBlockedUser));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*blockedActionsMenu_, wxString::FromUTF8(lila::shared::errors::SocialProfileActionBlockedList));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {
            blockedUsersList_,
            emptyBlockedUsersCtrl_,
            blockedActionsMenu_ != nullptr ? static_cast<wxWindow*>(blockedActionsMenu_->GetFirstButton()) : nullptr});
    blockedPanel_->SetSizer(sizer);
}

void SocialFrame::BuildProfileSection(wxWindow* parent)
{
    profilePanel_ = new wxPanel(parent);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    profileTitleLabel_ = new wxStaticText(profilePanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialMenuProfile));
    profileInfoCtrl_ = new wxTextCtrl(
        profilePanel_,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2);
    profileInfoCtrl_->SetMinSize(wxSize(-1, 210));

    auto* editorHost = new wxPanel(profilePanel_);
    auto* editorHostSizer = new wxBoxSizer(wxVERTICAL);

    profileEditorMenuPanel_ = new wxPanel(editorHost);
    auto* menuPanelSizer = new wxBoxSizer(wxVERTICAL);
    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 4> ProfileMenuItems = {{
        {"bio", wxString::FromUTF8(lila::shared::errors::SocialProfileEditBio), wxEmptyString},
        {"victory", wxString::FromUTF8(lila::shared::errors::SocialProfileEditVictory), wxEmptyString},
        {"defeat", wxString::FromUTF8(lila::shared::errors::SocialProfileEditDefeat), wxEmptyString},
        {"visibility", wxString::FromUTF8(lila::shared::errors::SocialProfileEditVisibility), wxEmptyString},
    }};
    profileMenu_ = new lila::shared::ui::controls::VerticalMenu(
        profileEditorMenuPanel_,
        lila::shared::ui::navigation::BuildMenuItems(ProfileMenuItems));
    menuPanelSizer->Add(profileMenu_, 1, wxEXPAND);
    profileEditorMenuPanel_->SetSizer(menuPanelSizer);

    profileBioEditorPanel_ = new wxPanel(editorHost);
    auto* bioSizer = new wxBoxSizer(wxVERTICAL);
    bioSizer->Add(new wxStaticText(profileBioEditorPanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialProfileBioLabel)), 0, wxBOTTOM, 8);
    profileBioCtrl_ = new wxTextCtrl(
        profileBioEditorPanel_,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_RICH2 | wxTE_PROCESS_TAB);
    profileBioCtrl_->SetMinSize(wxSize(-1, 180));
    bioSizer->Add(profileBioCtrl_, 1, wxEXPAND);
    profileBioEditorPanel_->SetSizer(bioSizer);

    profileVictoryEditorPanel_ = new wxPanel(editorHost);
    auto* victorySizer = new wxBoxSizer(wxVERTICAL);
    victorySizer->Add(new wxStaticText(profileVictoryEditorPanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialProfileVictoryLabel)), 0, wxBOTTOM, 8);
    profileVictoryCtrl_ = new wxTextCtrl(profileVictoryEditorPanel_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_TAB);
    victorySizer->Add(profileVictoryCtrl_, 0, wxEXPAND);
    profileVictoryEditorPanel_->SetSizer(victorySizer);

    profileDefeatEditorPanel_ = new wxPanel(editorHost);
    auto* defeatSizer = new wxBoxSizer(wxVERTICAL);
    defeatSizer->Add(new wxStaticText(profileDefeatEditorPanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialProfileDefeatLabel)), 0, wxBOTTOM, 8);
    profileDefeatCtrl_ = new wxTextCtrl(profileDefeatEditorPanel_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_TAB);
    defeatSizer->Add(profileDefeatCtrl_, 0, wxEXPAND);
    profileDefeatEditorPanel_->SetSizer(defeatSizer);

    profileVisibilityEditorPanel_ = new wxPanel(editorHost);
    auto* visibilitySizer = new wxBoxSizer(wxVERTICAL);
    visibilitySizer->Add(new wxStaticText(profileVisibilityEditorPanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialProfileVisibilityLabel)), 0, wxBOTTOM, 8);
    profileVisibilityChoice_ = new wxChoice(profileVisibilityEditorPanel_, wxID_ANY);
    profileVisibilityChoice_->Append(wxString::FromUTF8(lila::shared::errors::SocialProfileVisibilityChoicePublic), reinterpret_cast<void*>(0));
    profileVisibilityChoice_->Append(wxString::FromUTF8(lila::shared::errors::SocialProfileVisibilityChoiceFriends), reinterpret_cast<void*>(1));
    profileVisibilityChoice_->Append(wxString::FromUTF8(lila::shared::errors::SocialProfileVisibilityChoicePrivate), reinterpret_cast<void*>(2));
    visibilitySizer->Add(profileVisibilityChoice_, 0, wxEXPAND);
    profileVisibilityEditorPanel_->SetSizer(visibilitySizer);

    editorHostSizer->Add(profileEditorMenuPanel_, 1, wxEXPAND);
    editorHostSizer->Add(profileBioEditorPanel_, 1, wxEXPAND);
    editorHostSizer->Add(profileVictoryEditorPanel_, 1, wxEXPAND);
    editorHostSizer->Add(profileDefeatEditorPanel_, 1, wxEXPAND);
    editorHostSizer->Add(profileVisibilityEditorPanel_, 1, wxEXPAND);
    editorHost->SetSizer(editorHostSizer);

    auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
    profileSaveButton_ = new wxButton(profilePanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialProfileSave));
    profileCancelButton_ = new wxButton(profilePanel_, wxID_ANY, wxString::FromUTF8(lila::shared::errors::SocialProfileCancel));
    buttonSizer->Add(profileSaveButton_, 0, wxRIGHT, 10);
    buttonSizer->Add(profileCancelButton_, 0);

    rootSizer->Add(profileTitleLabel_, 0, wxBOTTOM, 10);
    rootSizer->Add(profileInfoCtrl_, 0, wxEXPAND | wxBOTTOM, 12);
    rootSizer->Add(editorHost, 1, wxEXPAND | wxBOTTOM, 12);
    rootSizer->Add(buttonSizer, 0, wxALIGN_LEFT);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileTitleLabel_, wxString::FromUTF8(lila::shared::errors::SocialProfileTitle));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileInfoCtrl_, wxString::FromUTF8(lila::shared::errors::SocialProfileDetails));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileBioCtrl_, wxString::FromUTF8(lila::shared::errors::SocialProfileBioLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileVictoryCtrl_, wxString::FromUTF8(lila::shared::errors::SocialProfileVictoryLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileDefeatCtrl_, wxString::FromUTF8(lila::shared::errors::SocialProfileDefeatLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileVisibilityChoice_, wxString::FromUTF8(lila::shared::errors::SocialProfileVisibilityLabel));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileSaveButton_, wxString::FromUTF8(lila::shared::errors::SocialProfileSave));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*profileCancelButton_, wxString::FromUTF8(lila::shared::errors::SocialProfileCancel));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {
            profileInfoCtrl_,
            profileMenu_,
            profileBioCtrl_,
            profileVictoryCtrl_,
            profileDefeatCtrl_,
            profileVisibilityChoice_,
            profileSaveButton_,
            profileCancelButton_});
    profilePanel_->SetSizer(rootSizer);
}

void SocialFrame::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    const auto applyWindowTheme = [](wxWindow* window)
    {
        if (window == nullptr)
        {
            return;
        }

        window->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
        window->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    for (wxWindow* child : GetChildren())
    {
        applyWindowTheme(child);
    }

    applyWindowTheme(friendsPanel_);
    applyWindowTheme(incomingRequestsPanel_);
    applyWindowTheme(outgoingRequestsPanel_);
    applyWindowTheme(blockedPanel_);
    applyWindowTheme(profilePanel_);
    applyWindowTheme(profileEditorMenuPanel_);
    applyWindowTheme(profileBioEditorPanel_);
    applyWindowTheme(profileVictoryEditorPanel_);
    applyWindowTheme(profileDefeatEditorPanel_);
    applyWindowTheme(profileVisibilityEditorPanel_);

    const auto styleList = [](lila::shared::ui::controls::VerticalMenu* menu)
    {
        if (menu == nullptr || menu->GetFirstButton() == nullptr)
        {
            return;
        }

        auto* listControl = menu->GetFirstButton();
        if (listControl != nullptr)
        {
            listControl->SetBackgroundColour(wxColour(14, 32, 52));
            listControl->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
        }
    };

    styleList(friendsList_);
    styleList(incomingRequestsList_);
    styleList(outgoingRequestsList_);
    styleList(blockedUsersList_);
    const auto styleText = [](wxTextCtrl* ctrl, bool readOnly)
    {
        if (ctrl == nullptr)
        {
            return;
        }

        ctrl->SetBackgroundColour(readOnly ? wxColour(14, 32, 52) : wxColour(10, 24, 39));
        ctrl->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    styleText(profileInfoCtrl_, true);
    styleText(profileBioCtrl_, false);
    styleText(profileVictoryCtrl_, false);
    styleText(profileDefeatCtrl_, false);
    styleText(emptyFriendsCtrl_, true);
    styleText(emptyIncomingRequestsCtrl_, true);
    styleText(emptyOutgoingRequestsCtrl_, true);
    styleText(emptyBlockedUsersCtrl_, true);

    if (profileVisibilityChoice_ != nullptr)
    {
        profileVisibilityChoice_->SetBackgroundColour(wxColour(10, 24, 39));
        profileVisibilityChoice_->SetForegroundColour(Theme::TextPrimary());
    }

    const auto stylePrimaryButton = [](wxButton* button)
    {
        if (button == nullptr)
        {
            return;
        }

        button->SetBackgroundColour(lila::shared::ui::Theme::AccentMuted());
        button->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    const auto styleSecondaryButton = [](wxButton* button)
    {
        if (button == nullptr)
        {
            return;
        }

        button->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
        button->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    stylePrimaryButton(profileSaveButton_);
    styleSecondaryButton(profileCancelButton_);
    statusLabel_->SetForegroundColour(Theme::Accent());
}
}

