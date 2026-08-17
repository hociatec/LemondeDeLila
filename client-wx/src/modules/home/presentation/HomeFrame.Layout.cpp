#include "modules/home/presentation/HomeFrame.h"

#include <wx/checkbox.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/ActionButton.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/config/AppConfig.h"

namespace lila::modules::home::presentation
{
void HomeFrame::BuildLayout()
{
    rootPanel_ = new wxPanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(rootPanel_, 0);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(headerPanel, wxID_ANY, wxString::FromUTF8(shared::config::AppConfig::AppTitle.data()));
    subtitleLabel_ = new wxStaticText(headerPanel, wxID_ANY, "Connexion ou inscription");
    headerSizer->AddStretchSpacer();
    headerSizer->Add(titleLabel_, 0, wxALIGN_CENTER | wxBOTTOM, 4);
    headerSizer->Add(subtitleLabel_, 0, wxALIGN_CENTER);
    headerSizer->AddStretchSpacer();
    headerPanel->SetSizer(headerSizer);

    cardPanel_ = new lila::shared::accessibility::NonFocusablePanel(rootPanel_);
    auto* cardOuterSizer = new wxBoxSizer(wxVERTICAL);
    statusLabel_ = new wxStaticText(cardPanel_, wxID_ANY, wxEmptyString);
    pages_ = new wxSimplebook(cardPanel_, wxID_ANY);
    BuildLandingPage();
    BuildLoginPage();
    BuildRegisterPage();
    cardOuterSizer->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, 18);
    cardOuterSizer->Add(pages_, 1, wxEXPAND | wxALL, 24);
    cardPanel_->SetSizer(cardOuterSizer);

    auto* footerPanel = new lila::shared::accessibility::NonFocusablePanel(rootPanel_, 0);
    auto* footerSizer = new wxBoxSizer(wxVERTICAL);
    auto* footerLabel = new wxStaticText(
        footerPanel,
        wxID_ANY,
        wxString::FromUTF8("Inspir" "\xC3\xA9" " du module Home WPF : navigation Landing/Login/Register et banni" "\xC3\xA8" "res d'" "\xC3\xA9" "tat."));
    footerSizer->AddStretchSpacer();
    footerSizer->Add(footerLabel, 0, wxALIGN_CENTER);
    footerSizer->AddStretchSpacer();
    footerPanel->SetSizer(footerSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP, 16);
    rootSizer->Add(cardPanel_, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(footerPanel, 0, wxEXPAND | wxBOTTOM, 12);
    rootPanel_->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(rootPanel_, 1, wxEXPAND);
    SetSizer(frameSizer);
}

void HomeFrame::BuildLandingPage()
{
    landingPage_ = new lila::shared::accessibility::NonFocusablePanel(pages_);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* intro = new wxStaticText(landingPage_, wxID_ANY, "Bienvenue, choisissez une action pour continuer.");
    landingLoginButton_ = new lila::shared::accessibility::ActionButton(landingPage_, wxID_ANY, "Se connecter");
    landingRegisterButton_ = new lila::shared::accessibility::ActionButton(landingPage_, wxID_ANY, wxString::FromUTF8("Cr" "\xC3\xA9" "er un compte"));
    landingQuitButton_ = new lila::shared::accessibility::ActionButton(landingPage_, wxID_ANY, "Quitter");
    auto* row = new wxBoxSizer(wxHORIZONTAL);
    row->Add(landingRegisterButton_, 0);
    row->Add(landingQuitButton_, 0, wxLEFT, 12);
    sizer->Add(intro, 0, wxBOTTOM, 16);
    sizer->Add(landingLoginButton_, 0, wxBOTTOM, 12);
    sizer->Add(row, 0);
    landingPage_->SetSizer(sizer);
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {landingLoginButton_, landingRegisterButton_, landingQuitButton_});
    pages_->AddPage(landingPage_, "Landing");
}

void HomeFrame::BuildLoginPage()
{
    loginPage_ = new lila::shared::accessibility::NonFocusablePanel(pages_);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(loginPage_, wxID_ANY, "Connexion");
    auto* usernameLabel = new wxStaticText(loginPage_, wxID_ANY, "Nom d'utilisateur");
    loginUsernameInput_ = new wxTextCtrl(loginPage_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER);
    auto* passwordLabel = new wxStaticText(loginPage_, wxID_ANY, "Mot de passe");
    loginPasswordInput_ = new wxTextCtrl(loginPage_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PASSWORD | wxTE_PROCESS_ENTER);
    loginPasswordTextInput_ = new wxTextCtrl(loginPage_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER);
    loginShowPasswordCheck_ = new wxCheckBox(loginPage_, wxID_ANY, "Afficher le mot de passe");
    loginRememberMeCheck_ = new wxCheckBox(loginPage_, wxID_ANY, "Se souvenir de moi");
    loginSubmitButton_ = new lila::shared::accessibility::ActionButton(loginPage_, wxID_ANY, "Connexion");
    loginRegisterButton_ = new lila::shared::accessibility::ActionButton(loginPage_, wxID_ANY, wxString::FromUTF8("Cr" "\xC3\xA9" "er un compte"));
    loginQuitButton_ = new lila::shared::accessibility::ActionButton(loginPage_, wxID_ANY, "Quitter");
    auto* checks = new wxBoxSizer(wxHORIZONTAL);
    checks->Add(loginShowPasswordCheck_, 0);
    checks->Add(loginRememberMeCheck_, 0, wxLEFT, 16);
    sizer->Add(title, 0, wxBOTTOM, 8);
    sizer->Add(usernameLabel, 0, wxTOP | wxBOTTOM, 4);
    sizer->Add(loginUsernameInput_, 0, wxEXPAND | wxBOTTOM, 8);
    sizer->Add(passwordLabel, 0, wxTOP | wxBOTTOM, 4);
    sizer->Add(loginPasswordInput_, 0, wxEXPAND | wxBOTTOM, 8);
    sizer->Add(loginPasswordTextInput_, 0, wxEXPAND | wxBOTTOM, 8);
    sizer->Add(checks, 0, wxTOP | wxBOTTOM, 8);
    sizer->Add(loginSubmitButton_, 0, wxBOTTOM, 8);
    sizer->Add(loginRegisterButton_, 0, wxBOTTOM, 8);
    sizer->Add(loginQuitButton_, 0);
    loginPage_->SetSizer(sizer);
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {
         loginUsernameInput_,
         loginPasswordInput_,
         loginPasswordTextInput_,
         loginShowPasswordCheck_,
         loginRememberMeCheck_,
         loginSubmitButton_,
         loginRegisterButton_,
         loginQuitButton_});
    pages_->AddPage(loginPage_, "Login");
}

void HomeFrame::BuildRegisterPage()
{
    registerPage_ = new lila::shared::accessibility::NonFocusablePanel(pages_);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(registerPage_, wxID_ANY, wxString::FromUTF8("Cr" "\xC3\xA9" "er un compte"));
    auto* usernameLabel = new wxStaticText(registerPage_, wxID_ANY, "Nom d'utilisateur");
    registerUsernameInput_ = new wxTextCtrl(registerPage_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER);
    auto* emailLabel = new wxStaticText(registerPage_, wxID_ANY, "Adresse email");
    registerEmailInput_ = new wxTextCtrl(
        registerPage_,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_PROCESS_ENTER);
    auto* passwordLabel = new wxStaticText(registerPage_, wxID_ANY, "Mot de passe");
    registerPasswordInput_ = new wxTextCtrl(registerPage_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PASSWORD | wxTE_PROCESS_ENTER);
    registerPasswordTextInput_ = new wxTextCtrl(registerPage_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER);
    registerShowPasswordCheck_ = new wxCheckBox(registerPage_, wxID_ANY, "Afficher le mot de passe");
    registerSubmitButton_ = new lila::shared::accessibility::ActionButton(registerPage_, wxID_ANY, wxString::FromUTF8("Cr" "\xC3\xA9" "er le compte"));
    registerBackButton_ = new lila::shared::accessibility::ActionButton(registerPage_, wxID_ANY, "Retour");
    auto* row = new wxBoxSizer(wxHORIZONTAL);
    row->Add(registerSubmitButton_, 0);
    row->Add(registerBackButton_, 0, wxLEFT, 8);
    sizer->Add(title, 0, wxBOTTOM, 8);
    sizer->Add(usernameLabel, 0, wxTOP | wxBOTTOM, 4);
    sizer->Add(registerUsernameInput_, 0, wxEXPAND | wxBOTTOM, 8);
    sizer->Add(emailLabel, 0, wxTOP | wxBOTTOM, 4);
    sizer->Add(registerEmailInput_, 0, wxEXPAND | wxBOTTOM, 8);
    sizer->Add(passwordLabel, 0, wxTOP | wxBOTTOM, 4);
    sizer->Add(registerPasswordInput_, 0, wxEXPAND | wxBOTTOM, 8);
    sizer->Add(registerPasswordTextInput_, 0, wxEXPAND | wxBOTTOM, 8);
    sizer->Add(registerShowPasswordCheck_, 0, wxTOP | wxBOTTOM, 8);
    sizer->Add(row, 0);
    registerPage_->SetSizer(sizer);
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {
         registerUsernameInput_,
         registerEmailInput_,
         registerPasswordInput_,
         registerPasswordTextInput_,
         registerShowPasswordCheck_,
         registerSubmitButton_,
         registerBackButton_});
    pages_->AddPage(registerPage_, "Register");
}
}
