#include "shared/text/Encoding.h"
#include "modules/main_menu/presentation/MainMenuFrame.h"

#include <span>
#include <vector>

#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/string.h>

#include "modules/main_menu/presentation/MainMenuContent.h"
#include "modules/session/application/SessionStore.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::main_menu::presentation
{
void MainMenuFrame::BuildLayout()
{
    const wxString username = lila::shared::text::FromUtf8(sessionStore_.Current().username);
    const wxString version = lila::shared::text::FromUtf8(shared::config::AppConfig::ResolveClientVersion());

    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(headerPanel, wxID_ANY, "Menu principal");
    titleLabel_->Hide();
    welcomeLabel_ = new wxStaticText(headerPanel, wxID_ANY, wxString(L"Bienvenue, ") + username);
    headerSizer->Add(titleLabel_, 0, wxALIGN_CENTER_HORIZONTAL);
    headerSizer->Add(welcomeLabel_, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    headerPanel->SetSizer(headerSizer);

    auto* navigationPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* navigationSizer = new wxBoxSizer(wxVERTICAL);
    navigationLabel_ = new wxStaticText(navigationPanel, wxID_ANY, "Navigation");
    navigationLabel_->Hide();
    navigationSizer->Add(navigationLabel_, 0, wxBOTTOM, 12);

    const auto entries = GetMainMenuEntries();
    std::vector<lila::shared::ui::controls::VerticalMenuItem> menuItems;
    menuItems.reserve(entries.size());
    for (std::size_t index = 0; index < entries.size(); ++index)
    {
        menuItems.push_back({std::to_string(index), wxString(entries[index].label.data())});
    }
    menu_ = new lila::shared::ui::controls::VerticalMenu(
        navigationPanel,
        std::span<const lila::shared::ui::controls::VerticalMenuItem>(menuItems.data(), menuItems.size()),
        lila::shared::ui::controls::VerticalMenuRole::Entries);
    menu_->SetMinSize(wxSize(320, -1));
    navigationSizer->Add(menu_, 1, wxEXPAND);
    navigationSizer->AddStretchSpacer();
    navigationPanel->SetSizer(navigationSizer);

    auto* footerPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* footerSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel_ = new wxStaticText(
        footerPanel,
        wxID_ANY,
        wxString(L"Flèches haut/bas : naviguer. Entrée : sélectionner."));
    versionLabel_ = new wxStaticText(footerPanel, wxID_ANY, wxString(L"Version ") + version);
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
