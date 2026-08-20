#include "modules/about/presentation/AboutFrame.h"

#include <span>

#include <wx/button.h>
#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::about::presentation
{
void AboutFrame::BuildLayout()
{
    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(headerPanel, wxID_ANY, wxString(L"À propos"));
    auto* subtitleLabel = new wxStaticText(
        headerPanel,
        wxID_ANY,
        wxString(L"Informations du client natif, raccourcis clavier et contact administrateur."));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel_, wxString(L"À propos"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subtitleLabel, wxString(L"Informations"));
    headerSizer->Add(titleLabel_, 0, wxBOTTOM, 6);
    headerSizer->Add(subtitleLabel, 0);
    headerPanel->SetSizer(headerSizer);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* contentSizer = new wxBoxSizer(wxVERTICAL);

    static const lila::shared::ui::controls::VerticalMenuItem rootItems[] = {
        {"shortcuts", wxString(L"Raccourcis")},
        {"info", wxString(L"Informations sur l'application")},
        {"contact", wxString(L"Contacter un administrateur")}};
    itemsList_ = new lila::shared::ui::controls::VerticalMenu(
        contentPanel,
        std::span<const lila::shared::ui::controls::VerticalMenuItem>(rootItems, 3));
    detailsLabel_ = new wxStaticText(contentPanel, wxID_ANY, wxEmptyString);
    shortcutsTextCtrl_ = new wxTextCtrl(
        contentPanel,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2);
    auto* contactPanel = new lila::shared::accessibility::NonFocusablePanel(contentPanel, 0);
    contactMessageCtrl_ = new wxTextCtrl(
        contactPanel,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_RICH2);
    contactMessageCtrl_->SetMinSize(wxSize(-1, 180));

    auto* contactButtonsSizer = new wxBoxSizer(wxHORIZONTAL);
    sendContactButton_ = new wxButton(contactPanel, wxID_ANY, L"Envoyer");
    cancelContactButton_ = new wxButton(contactPanel, wxID_ANY, L"Annuler");
    contactButtonsSizer->Add(sendContactButton_, 0, wxRIGHT, 10);
    contactButtonsSizer->Add(cancelContactButton_, 0);

    auto* contactSizer = new wxBoxSizer(wxVERTICAL);
    auto* contactLabel = new wxStaticText(contactPanel, wxID_ANY, L"Votre message au staff");
    auto* contactHint = new wxStaticText(
        contactPanel,
        wxID_ANY,
        wxString(L"Le formulaire est préparé, mais l'envoi réseau du client wx n'est pas encore branché."));
    contactSizer->Add(contactLabel, 0, wxBOTTOM, 8);
    contactSizer->Add(contactHint, 0, wxBOTTOM, 10);
    contactSizer->Add(contactMessageCtrl_, 1, wxEXPAND | wxBOTTOM, 12);
    contactSizer->Add(contactButtonsSizer, 0, wxALIGN_LEFT);
    contactPanel->SetSizer(contactSizer);

    contentSizer->Add(itemsList_, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(shortcutsTextCtrl_, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(contactPanel, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(detailsLabel_, 0, wxEXPAND);
    contentPanel->SetSizer(contentSizer);

    auto* footerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* footerSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel_ = new wxStaticText(footerPanel, wxID_ANY, wxEmptyString);
    footerSizer->AddStretchSpacer();
    footerSizer->Add(statusLabel_, 0, wxALIGN_CENTER_VERTICAL);
    footerPanel->SetSizer(footerSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(contentPanel, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(footerPanel, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 20);
    root->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(root, 1, wxEXPAND);
    SetSizer(frameSizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*itemsList_, wxString(L"Menu d'informations"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*detailsLabel_, wxString(L"Détails"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*shortcutsTextCtrl_, wxString(L"Liste des raccourcis"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*contactMessageCtrl_, wxString(L"Message au staff"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sendContactButton_, wxString(L"Envoyer le message"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*cancelContactButton_, wxString(L"Annuler"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel_, wxString(L"État"));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {itemsList_, shortcutsTextCtrl_, contactMessageCtrl_, sendContactButton_, cancelContactButton_});
}

void AboutFrame::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    auto applyPanelTheme = [](wxWindow* window)
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
        applyPanelTheme(child);
    }

    itemsList_->ApplyTheme();
    shortcutsTextCtrl_->SetBackgroundColour(wxColour(14, 32, 52));
    shortcutsTextCtrl_->SetForegroundColour(Theme::TextPrimary());
    contactMessageCtrl_->SetBackgroundColour(wxColour(14, 32, 52));
    contactMessageCtrl_->SetForegroundColour(Theme::TextPrimary());
    sendContactButton_->SetBackgroundColour(Theme::AccentMuted());
    sendContactButton_->SetForegroundColour(Theme::TextPrimary());
    cancelContactButton_->SetBackgroundColour(Theme::PanelBackground());
    cancelContactButton_->SetForegroundColour(Theme::TextPrimary());
    detailsLabel_->SetForegroundColour(Theme::TextMuted());
    statusLabel_->SetForegroundColour(Theme::Accent());
}
}
