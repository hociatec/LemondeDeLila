#include "modules/main_menu/presentation/MainMenuFrame.h"

#include <string>
#include <vector>

#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/string.h>

#include "modules/main_menu/presentation/MainMenuContent.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace lila::modules::main_menu::presentation
{
void MainMenuFrame::BuildLayout()
{
    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(headerPanel, wxID_ANY, "Menu principal");
    welcomeLabel_ = new wxStaticText(
        headerPanel,
        wxID_ANY,
        wxString::Format(
            "Bienvenue, %s",
            wxString::FromUTF8(sessionStore_.Current().username)));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel_, wxString(L"Menu principal"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *welcomeLabel_,
        wxString::Format(wxString(L"Bienvenue, %s"), wxString::FromUTF8(sessionStore_.Current().username)));
    headerSizer->Add(titleLabel_, 0, wxALIGN_CENTER_HORIZONTAL);
    headerSizer->Add(welcomeLabel_, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    headerPanel->SetSizer(headerSizer);

    auto* navigationPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* navigationSizer = new wxBoxSizer(wxVERTICAL);
    navigationLabel_ = new wxStaticText(navigationPanel, wxID_ANY, "Navigation");
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*navigationLabel_, wxString(L"Navigation"));
    const auto entries = GetMainMenuEntries();
    std::vector<lila::shared::ui::navigation::MenuBlueprintItem> menuItems;
    menuItems.reserve(entries.size());
    for (std::size_t index = 0; index < entries.size(); ++index)
    {
        menuItems.push_back(
            {std::to_string(index), wxString(entries[index].label.data()), wxString(entries[index].statusMessage.data())});
    }
    menu_ = new lila::shared::ui::controls::VerticalMenu(
        navigationPanel,
        lila::shared::ui::navigation::BuildMenuItems(menuItems));
    menu_->SetMinSize(wxSize(320, 220));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*menu_, wxString(L"Menu principal"));
    navigationSizer->Add(navigationLabel_, 0, wxBOTTOM, 12);
    navigationSizer->Add(menu_, 0, wxEXPAND);
    navigationSizer->AddStretchSpacer();
    navigationPanel->SetSizer(navigationSizer);

    auto* footerPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* footerSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel_ = new wxStaticText(
        footerPanel,
        wxID_ANY,
        wxString(L"Flèches haut/bas : naviguer. Entrée : sélectionner."));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel_, wxString(L"État"));
    versionLabel_ = new wxStaticText(
        footerPanel,
        wxID_ANY,
        wxString::Format(
            "Version %s",
            wxString::FromUTF8(shared::config::AppConfig::ResolveClientVersion())));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *versionLabel_,
        wxString::Format(wxString(L"Version %s"), wxString::FromUTF8(shared::config::AppConfig::ResolveClientVersion())));
    footerSizer->AddStretchSpacer();
    footerSizer->Add(statusLabel_, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, 20);
    footerSizer->Add(versionLabel_, 0, wxALIGN_CENTER_VERTICAL);
    footerPanel->SetSizer(footerSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(navigationPanel, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(footerPanel, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 20);
    root->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(root, 1, wxEXPAND);
    SetSizer(frameSizer);
}
}
