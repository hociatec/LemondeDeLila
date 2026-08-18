#include "shared/text/Encoding.h"
SocialView::SocialView(wxWindow* parent): wxPanel(parent) { BuildLayout(); }
void SocialView::BuildLayout()
{
    auto* root = this;
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel = new wxStaticText(headerPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialSocialHeader));
    subtitleLabel = new wxStaticText(headerPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::SocialSocialSubtitle));
    headerSizer->Add(titleLabel, 0, wxBOTTOM, 6);
    headerSizer->Add(subtitleLabel, 0);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel, lila::shared::text::FromUtf8(lila::shared::errors::SocialSocialHeader));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subtitleLabel, lila::shared::text::FromUtf8(lila::shared::errors::SocialSocialSubtitle));
    headerPanel->SetSizer(headerSizer);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* contentSizer = new wxBoxSizer(wxHORIZONTAL);

    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 6> MenuItems = {{
        {"messaging", lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuMessaging), wxEmptyString},
        {"friends", lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuFriends), wxEmptyString},
        {"incoming", lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuIncomingRequests), wxEmptyString},
        {"outgoing", lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuOutgoingRequests), wxEmptyString},
        {"blocked", lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuBlocked), wxEmptyString},
        {"profile", lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuProfile), wxEmptyString},
    }};

    menu = new lila::shared::ui::controls::VerticalMenu(
        contentPanel,
        lila::shared::ui::navigation::BuildMenuItems(MenuItems));
    menu->SetMinSize(wxSize(260, -1));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*menu, lila::shared::text::FromUtf8(lila::shared::errors::SocialNavigationMenuAccessible));

    sectionBook = new wxSimplebook(contentPanel, wxID_ANY);
    BuildFriendsSection(sectionBook);
    BuildIncomingRequestsSection(sectionBook);
    BuildOutgoingRequestsSection(sectionBook);
    BuildBlockedSection(sectionBook);
    BuildProfileSection(sectionBook);
    sectionBook->AddPage(friendsPanel, lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuFriends));
    sectionBook->AddPage(incomingRequestsPanel, lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuIncomingRequests));
    sectionBook->AddPage(outgoingRequestsPanel, lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuOutgoingRequests));
    sectionBook->AddPage(blockedPanel, lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuBlocked));
    sectionBook->AddPage(profilePanel, lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuProfile));

    contentSizer->Add(menu, 0, wxEXPAND | wxRIGHT, 20);
    contentSizer->Add(sectionBook, 1, wxEXPAND);
    contentPanel->SetSizer(contentSizer);

    auto* footerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* footerSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel = new wxStaticText(footerPanel, wxID_ANY, wxEmptyString);
    footerSizer->Add(statusLabel, 1, wxALIGN_CENTER_VERTICAL);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel, lila::shared::text::FromUtf8(lila::shared::errors::SocialSocialStateAccessible));
    footerPanel->SetSizer(footerSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(contentPanel, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(footerPanel, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 20);
    root->SetSizer(rootSizer);

    SetSizer(rootSizer);
}

