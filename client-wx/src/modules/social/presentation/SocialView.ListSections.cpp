#include "modules/social/presentation/SocialView.h"

#include "shared/text/Encoding.h"

#include <vector>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace
{
struct SocialListSectionControls
{
    wxPanel* panel = nullptr;
    lila::shared::ui::controls::VerticalMenu* list = nullptr;
    wxTextCtrl* emptyState = nullptr;
    lila::shared::ui::controls::VerticalMenu* actions = nullptr;
};

SocialListSectionControls BuildSocialListSection(
    wxWindow* parent,
    const wxString& titleText,
    const wxString& emptyText,
    const wxString& actionsAccessibleName,
    const std::vector<lila::shared::ui::navigation::MenuBlueprintItem>& actionItems)
{
    SocialListSectionControls controls;
    controls.panel = new wxPanel(parent);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*controls.panel, wxEmptyString, wxEmptyString);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(controls.panel, wxID_ANY, titleText);
    title->Hide();
    controls.list = new lila::shared::ui::controls::VerticalMenu(
        controls.panel,
        {},
        lila::shared::ui::controls::VerticalMenuRole::List);
    controls.list->SetMinSize(wxSize(260, -1));
    controls.emptyState = new wxTextCtrl(
        controls.panel,
        wxID_ANY,
        emptyText,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    controls.emptyState->SetMinSize(wxSize(-1, 80));
    controls.actions = new lila::shared::ui::controls::VerticalMenu(
        controls.panel,
        lila::shared::ui::navigation::BuildMenuItems(actionItems),
        lila::shared::ui::controls::VerticalMenuRole::List);
    controls.actions->SetMinSize(wxSize(260, -1));
    controls.actions->Show(false);
    controls.actions->Enable(false);

    sizer->Add(title, 0, wxBOTTOM, 10);
    sizer->Add(controls.list, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(controls.emptyState, 0, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(controls.actions, 0, wxEXPAND);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*controls.list, titleText);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*controls.emptyState, emptyText);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*controls.actions, actionsAccessibleName);
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {controls.list,
         controls.emptyState,
         controls.actions != nullptr ? static_cast<wxWindow*>(controls.actions->GetFirstButton()) : nullptr});
    controls.panel->SetSizer(sizer);
    return controls;
}
}

namespace lila::modules::social::presentation
{
void SocialView::BuildFriendsSection(wxWindow* parent)
{
    const std::vector<lila::shared::ui::navigation::MenuBlueprintItem> actions = {
        {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView), wxEmptyString},
        {"remove-friend", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionRemoveFriend), wxEmptyString},
        {"block-friend", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionBlock), wxEmptyString},
    };
    const auto controls = BuildSocialListSection(
        parent,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialSectionFriends),
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialNoFriend),
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionMenuList),
        actions);
    friendsPanel = controls.panel;
    friendsList = controls.list;
    emptyFriendsCtrl = controls.emptyState;
    friendsActionsMenu = controls.actions;
}

void SocialView::BuildIncomingRequestsSection(wxWindow* parent)
{
    const std::vector<lila::shared::ui::navigation::MenuBlueprintItem> actions = {
        {"accept-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionAccept), wxEmptyString},
        {"reject-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionReject), wxEmptyString},
        {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView), wxEmptyString},
        {"block-user", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionBlock), wxEmptyString},
    };
    const auto controls = BuildSocialListSection(
        parent,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuIncomingRequests),
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialNoIncomingRequest),
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionIncomingList),
        actions);
    incomingRequestsPanel = controls.panel;
    incomingRequestsList = controls.list;
    emptyIncomingRequestsCtrl = controls.emptyState;
    incomingActionsMenu = controls.actions;
}

void SocialView::BuildOutgoingRequestsSection(wxWindow* parent)
{
    const std::vector<lila::shared::ui::navigation::MenuBlueprintItem> actions = {
        {"cancel-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionCancel), wxEmptyString},
        {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView), wxEmptyString},
        {"block-user", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionBlock), wxEmptyString},
    };
    const auto controls = BuildSocialListSection(
        parent,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuOutgoingRequests),
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialNoOutgoingRequest),
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionOutgoingList),
        actions);
    outgoingRequestsPanel = controls.panel;
    outgoingRequestsList = controls.list;
    emptyOutgoingRequestsCtrl = controls.emptyState;
    outgoingActionsMenu = controls.actions;
}

void SocialView::BuildBlockedSection(wxWindow* parent)
{
    const std::vector<lila::shared::ui::navigation::MenuBlueprintItem> actions = {
        {"unblock-user", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionUnblock), wxEmptyString},
    };
    const auto controls = BuildSocialListSection(
        parent,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuBlocked),
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialNoBlockedUser),
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionBlockedList),
        actions);
    blockedPanel = controls.panel;
    blockedUsersList = controls.list;
    emptyBlockedUsersCtrl = controls.emptyState;
    blockedActionsMenu = controls.actions;
}
}
