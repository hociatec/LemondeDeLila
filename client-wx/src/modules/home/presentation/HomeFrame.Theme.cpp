#include "modules/home/presentation/HomeFrame.h"

#include <wx/checkbox.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/ActionButton.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/ui/Theme.h"

namespace lila::modules::home::presentation
{
void HomeFrame::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(wxColour(15, 29, 45));
    rootPanel_->SetBackgroundColour(wxColour(15, 29, 45));
    cardPanel_->SetBackgroundColour(wxColour(22, 42, 68));
    statusLabel_->SetBackgroundColour(wxColour(22, 42, 68));
    pages_->SetBackgroundColour(wxColour(22, 42, 68));

    titleLabel_->SetFont(wxFontInfo(28).FaceName("Segoe UI").Bold());
    titleLabel_->SetForegroundColour(*wxWHITE);
    subtitleLabel_->SetFont(wxFontInfo(14).FaceName("Segoe UI"));
    subtitleLabel_->SetForegroundColour(wxColour(156, 178, 209));
    statusLabel_->SetFont(Theme::BodyFont());
    statusLabel_->SetForegroundColour(Theme::Accent());

    const auto styleTextInput = [](wxTextCtrl* input)
    {
        input->SetFont(wxFontInfo(10).FaceName("Segoe UI"));
        input->SetBackgroundColour(wxColour(13, 26, 43));
        input->SetForegroundColour(*wxWHITE);
    };

    styleTextInput(loginUsernameInput_);
    styleTextInput(loginPasswordInput_);
    styleTextInput(loginPasswordTextInput_);
    styleTextInput(registerUsernameInput_);
    styleTextInput(registerEmailInput_);
    styleTextInput(registerPasswordInput_);
    styleTextInput(registerPasswordTextInput_);

    loginPasswordTextInput_->Hide();
    registerPasswordTextInput_->Hide();

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel_, wxString(L"État"), wxString(L"État courant"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel_, wxString(L"Bienvenue"), wxString(L"Titre de la fenêtre"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subtitleLabel_, wxString(L"Accueil"), wxString(L"Sous-titre"));

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *landingLoginButton_,
        wxString(L"Se connecter"),
        wxString(L"Action principale"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *landingRegisterButton_,
        wxString(L"Créer un compte"),
        wxString(L"Aller à l'inscription"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *landingQuitButton_,
        wxString(L"Quitter"),
        wxString(L"Quitter l'application"));

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*loginUsernameInput_, wxString(L"Nom d'utilisateur"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*loginPasswordInput_, wxString(L"Mot de passe"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*loginPasswordTextInput_, wxString(L"Mot de passe"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*loginShowPasswordCheck_, wxString(L"Afficher le mot de passe"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*loginRememberMeCheck_, wxString(L"Se souvenir de moi"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *loginSubmitButton_,
        wxString(L"Connexion"),
        wxString(L"Valider la connexion"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *loginRegisterButton_,
        wxString(L"Créer un compte"),
        wxString(L"Créer un compte"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *loginQuitButton_,
        wxString(L"Quitter"),
        wxString(L"Quitter la page de connexion"));

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*registerUsernameInput_, wxString(L"Nom d'utilisateur"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*registerEmailInput_, wxString(L"Adresse email"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*registerPasswordInput_, wxString(L"Mot de passe"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*registerPasswordTextInput_, wxString(L"Mot de passe"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*registerShowPasswordCheck_, wxString(L"Afficher le mot de passe"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *registerSubmitButton_,
        wxString(L"Créer le compte"),
        wxString(L"Créer un compte"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*registerBackButton_, wxString(L"Retour"));

    const auto applyButtonStyle = [](lila::shared::accessibility::ActionButton* button, const wxColour& background)
    {
        button->SetFont(wxFontInfo(10).FaceName("Segoe UI").Bold());
        button->SetForegroundColour(*wxWHITE);
        button->SetBackgroundColour(background);
    };

    applyButtonStyle(landingLoginButton_, wxColour(30, 58, 92));
    applyButtonStyle(landingRegisterButton_, wxColour(35, 74, 122));
    applyButtonStyle(landingQuitButton_, wxColour(116, 42, 42));
    applyButtonStyle(loginSubmitButton_, wxColour(43, 108, 176));
    applyButtonStyle(loginRegisterButton_, wxColour(35, 74, 122));
    applyButtonStyle(loginQuitButton_, wxColour(116, 42, 42));
    applyButtonStyle(registerSubmitButton_, wxColour(46, 139, 87));
    applyButtonStyle(registerBackButton_, wxColour(59, 66, 80));

    loginShowPasswordCheck_->SetForegroundColour(*wxWHITE);
    loginRememberMeCheck_->SetForegroundColour(*wxWHITE);
    registerShowPasswordCheck_->SetForegroundColour(*wxWHITE);

    SetStatus(wxEmptyString);
}
}
