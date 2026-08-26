#include "modules/social/presentation/SocialView.h"

#include "shared/text/presentation/encoding/Encoding.h"

#include <array>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/navigation/MenuBlueprint.h"

namespace lila::modules::social::presentation
{
void SocialView::BuildLayout()
{
    auto* root = this;
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel = new wxStaticText(headerPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialSocialHeader));
    subtitleLabel = new wxStaticText(headerPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialSocialSubtitle));
    titleLabel->Hide();
    subtitleLabel->Hide();
    headerSizer->Add(titleLabel, 0, wxBOTTOM, 6);
    headerSizer->Add(subtitleLabel, 0);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialSocialHeader));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subtitleLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialSocialSubtitle));
    headerPanel->SetSizer(headerSizer);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* contentSizer = new wxBoxSizer(wxHORIZONTAL);

    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 6> MenuItems = {{
        {"messaging", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuMessaging)},
        {"friends", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuFriends)},
        {"incoming", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuIncomingRequests)},
        {"outgoing", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuOutgoingRequests)},
        {"blocked", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuBlocked)},
        {"profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuProfile)},
    }};

    menu = new lila::shared::ui::controls::VerticalMenu(
        contentPanel,
        lila::shared::ui::navigation::BuildMenuItems(MenuItems),
        lila::shared::ui::controls::VerticalMenuRole::Entries);
    menu->SetMinSize(wxSize(260, -1));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*menu, wxString(L"Social"));

    sectionBook = new wxSimplebook(contentPanel, wxID_ANY);
    BuildFriendsSection(sectionBook);
    BuildIncomingRequestsSection(sectionBook);
    BuildOutgoingRequestsSection(sectionBook);
    BuildBlockedSection(sectionBook);
    BuildProfileSection(sectionBook);
    sectionBook->AddPage(friendsPanel, wxEmptyString);
    sectionBook->AddPage(incomingRequestsPanel, wxEmptyString);
    sectionBook->AddPage(outgoingRequestsPanel, wxEmptyString);
    sectionBook->AddPage(blockedPanel, wxEmptyString);
    sectionBook->AddPage(profilePanel, wxEmptyString);

    contentSizer->Add(menu, 0, wxEXPAND | wxRIGHT, 20);
    contentSizer->Add(sectionBook, 1, wxEXPAND);
    contentPanel->SetSizer(contentSizer);

    auto* footerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* footerSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel = new wxStaticText(footerPanel, wxID_ANY, wxEmptyString);
    footerSizer->Add(statusLabel, 1, wxALIGN_CENTER_VERTICAL);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::SocialSocialStateAccessible));
    footerPanel->SetSizer(footerSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(contentPanel, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(footerPanel, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 20);
    root->SetSizer(rootSizer);

    SetSizer(rootSizer);
}
}
