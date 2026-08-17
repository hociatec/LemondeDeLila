#pragma once

#include <functional>

#include <wx/frame.h>

#include "modules/user/domain/AuthenticationResult.h"

class wxCheckBox;
class wxPanel;
class wxSimplebook;
class wxStaticText;
class wxTextCtrl;

namespace lila::shared::accessibility
{
class ActionButton;
class NonFocusablePanel;
}

namespace lila::modules::user::application
{
class LoginUseCase;
class RegisterUseCase;
}

namespace lila::modules::home::presentation
{
class HomeFrame final : public wxFrame
{
public:
    using LoginSucceededHandler = std::function<void(const lila::modules::user::domain::AuthenticationResult&)>;

    HomeFrame(
        lila::modules::user::application::LoginUseCase& loginUseCase,
        lila::modules::user::application::RegisterUseCase& registerUseCase,
        LoginSucceededHandler onLoginSucceeded);

private:
    enum class Page
    {
        Landing,
        Login,
        Register
    };

    void BuildLayout();
    void BuildLandingPage();
    void BuildLoginPage();
    void BuildRegisterPage();
    void ApplyTheme();
    void BindEvents();
    void ShowPage(Page page);
    void SetStatus(const wxString& message, bool isError = false);
    void FocusCurrentPagePrimaryField();
    void ToggleLoginPasswordMode();
    void ToggleRegisterPasswordMode();
    void OnShowLogin(wxCommandEvent& event);
    void OnShowRegister(wxCommandEvent& event);
    void OnShowLanding(wxCommandEvent& event);
    void OnLoginSubmit(wxCommandEvent& event);
    void OnRegisterSubmit(wxCommandEvent& event);
    void OnQuit(wxCommandEvent& event);
    void SetBusyState(bool isBusy, const wxString& statusMessage = wxEmptyString);
    void SetFormInteractivity(Page page, bool enabled);

    lila::modules::user::application::LoginUseCase& loginUseCase_;
    lila::modules::user::application::RegisterUseCase& registerUseCase_;
    LoginSucceededHandler onLoginSucceeded_;
    Page currentPage_ = Page::Landing;

    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* subtitleLabel_ = nullptr;
    wxPanel* rootPanel_ = nullptr;
    lila::shared::accessibility::NonFocusablePanel* cardPanel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    wxSimplebook* pages_ = nullptr;

    lila::shared::accessibility::NonFocusablePanel* landingPage_ = nullptr;
    lila::shared::accessibility::ActionButton* landingLoginButton_ = nullptr;
    lila::shared::accessibility::ActionButton* landingRegisterButton_ = nullptr;
    lila::shared::accessibility::ActionButton* landingQuitButton_ = nullptr;

    lila::shared::accessibility::NonFocusablePanel* loginPage_ = nullptr;
    wxTextCtrl* loginUsernameInput_ = nullptr;
    wxTextCtrl* loginPasswordInput_ = nullptr;
    wxTextCtrl* loginPasswordTextInput_ = nullptr;
    wxCheckBox* loginShowPasswordCheck_ = nullptr;
    wxCheckBox* loginRememberMeCheck_ = nullptr;
    lila::shared::accessibility::ActionButton* loginSubmitButton_ = nullptr;
    lila::shared::accessibility::ActionButton* loginRegisterButton_ = nullptr;
    lila::shared::accessibility::ActionButton* loginQuitButton_ = nullptr;

    lila::shared::accessibility::NonFocusablePanel* registerPage_ = nullptr;
    wxTextCtrl* registerUsernameInput_ = nullptr;
    wxTextCtrl* registerEmailInput_ = nullptr;
    wxTextCtrl* registerPasswordInput_ = nullptr;
    wxTextCtrl* registerPasswordTextInput_ = nullptr;
    wxCheckBox* registerShowPasswordCheck_ = nullptr;
    lila::shared::accessibility::ActionButton* registerSubmitButton_ = nullptr;
    lila::shared::accessibility::ActionButton* registerBackButton_ = nullptr;
    bool isBusy_ = false;
};
}
