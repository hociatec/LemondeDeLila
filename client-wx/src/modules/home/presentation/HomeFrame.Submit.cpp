#include "modules/home/presentation/HomeFrame.h"
#include "shared/ui/BackgroundTask.h"
#include "shared/errors/ErrorMessages.h"

#include <memory>
#include <thread>

#include <wx/checkbox.h>
#include <wx/app.h>
#include <wx/weakref.h>
#include <wx/textctrl.h>

#include "shared/accessibility/ActionButton.h"
#include "modules/home/application/HomeAuthValidator.h"
#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"
#include "modules/user/domain/LoginCredentials.h"
#include "modules/user/domain/RegistrationResult.h"
#include "modules/user/domain/RegisterRequest.h"

namespace lila::modules::home::presentation
{
void HomeFrame::SetBusyState(bool isBusy, const wxString& statusMessage)
{
    isBusy_ = isBusy;

    SetFormInteractivity(Page::Landing, !isBusy);
    SetFormInteractivity(Page::Login, !isBusy);
    SetFormInteractivity(Page::Register, !isBusy);

    if (!statusMessage.empty())
    {
        SetStatus(statusMessage, false);
    }

    if (!isBusy)
    {
        FocusCurrentPagePrimaryField();
    }
}

void HomeFrame::SetFormInteractivity(Page page, bool enabled)
{
    if (page == Page::Landing)
    {
        if (landingLoginButton_ != nullptr) landingLoginButton_->Enable(enabled);
        if (landingRegisterButton_ != nullptr) landingRegisterButton_->Enable(enabled);
        if (landingQuitButton_ != nullptr) landingQuitButton_->Enable(enabled);
        return;
    }

    if (page == Page::Login)
    {
        if (loginUsernameInput_ != nullptr) loginUsernameInput_->Enable(enabled);
        if (loginPasswordInput_ != nullptr) loginPasswordInput_->Enable(enabled);
        if (loginPasswordTextInput_ != nullptr) loginPasswordTextInput_->Enable(enabled);
        if (loginShowPasswordCheck_ != nullptr) loginShowPasswordCheck_->Enable(enabled);
        if (loginRememberMeCheck_ != nullptr) loginRememberMeCheck_->Enable(enabled);
        if (loginSubmitButton_ != nullptr) loginSubmitButton_->Enable(enabled);
        if (loginRegisterButton_ != nullptr) loginRegisterButton_->Enable(enabled);
        if (loginQuitButton_ != nullptr) loginQuitButton_->Enable(enabled);
        return;
    }

    if (page == Page::Register)
    {
        if (registerUsernameInput_ != nullptr) registerUsernameInput_->Enable(enabled);
        if (registerEmailInput_ != nullptr) registerEmailInput_->Enable(enabled);
        if (registerPasswordInput_ != nullptr) registerPasswordInput_->Enable(enabled);
        if (registerPasswordTextInput_ != nullptr) registerPasswordTextInput_->Enable(enabled);
        if (registerShowPasswordCheck_ != nullptr) registerShowPasswordCheck_->Enable(enabled);
        if (registerSubmitButton_ != nullptr) registerSubmitButton_->Enable(enabled);
        if (registerBackButton_ != nullptr) registerBackButton_->Enable(enabled);
    }
}

void HomeFrame::OnLoginSubmit(wxCommandEvent& event)
{
    (void)event;

    if (isBusy_)
    {
        SetStatus(wxString::FromUTF8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    user::domain::LoginCredentials credentials;
    credentials.username = loginUsernameInput_->GetValue().ToStdString();
    credentials.password = loginShowPasswordCheck_->GetValue()
        ? loginPasswordTextInput_->GetValue().ToStdString()
        : loginPasswordInput_->GetValue().ToStdString();

    if (const auto validationError = application::HomeAuthValidator::ValidateLogin(credentials.username, credentials.password))
    {
        SetStatus(wxString::FromUTF8(*validationError), true);
        return;
    }

    const bool rememberSession = loginRememberMeCheck_->GetValue();
    SetBusyState(true, wxString::FromUTF8("Connexion au serveur..."));
    SetStatus(wxString::FromUTF8("Authentification..."));

    auto result = std::make_shared<std::optional<user::domain::AuthenticationResult>>();
    wxWeakRef<HomeFrame> weakSelf(this);

    lila::shared::ui::RunBackgroundTaskWithResult<user::domain::AuthenticationResult>(
        this,
        [this, credentials = std::move(credentials)]()
        {
            return loginUseCase_.Execute(credentials);
        },
        [weakSelf, rememberSession](std::string errorMessage, std::optional<user::domain::AuthenticationResult> result) mutable
        {
            if (!weakSelf)
            {
                return;
            }

            weakSelf->SetBusyState(false);
            if (!errorMessage.empty() || !result.has_value())
            {
                weakSelf->SetStatus(wxString::FromUTF8(lila::shared::errors::AuthenticationFailed), true);
                return;
            }

            const auto& loginResult = result.value();
            if (!loginResult.success)
            {
                weakSelf->SetStatus(
                    loginResult.message.empty()
                        ? wxString::FromUTF8(lila::shared::errors::AuthenticationFailed)
                        : wxString::Format(
                            wxString(L"%s %s"),
                            wxString::FromUTF8(lila::shared::errors::AuthenticationFailed),
                            wxString::FromUTF8(loginResult.message)),
                    true);
                return;
            }

            auto forwardedResult = loginResult;
            forwardedResult.rememberSession = rememberSession;
            weakSelf->SetStatus(wxString::FromUTF8("Chargement des données..."));
            if (weakSelf->onLoginSucceeded_)
            {
                weakSelf->onLoginSucceeded_(forwardedResult);
            }
        });
}

void HomeFrame::OnRegisterSubmit(wxCommandEvent& event)
{
    (void)event;

    if (isBusy_)
    {
        SetStatus(wxString::FromUTF8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    user::domain::RegisterRequest request;
    request.username = registerUsernameInput_->GetValue().ToStdString();
    request.email = registerEmailInput_->GetValue().ToStdString();
    request.password = registerShowPasswordCheck_->GetValue()
        ? registerPasswordTextInput_->GetValue().ToStdString()
        : registerPasswordInput_->GetValue().ToStdString();

    if (const auto validationError = application::HomeAuthValidator::ValidateRegistration(
            request.username,
            request.email,
            request.password))
    {
        SetStatus(wxString::FromUTF8(*validationError), true);
        return;
    }

    SetBusyState(true, wxString::FromUTF8("Connexion au serveur..."));
    SetStatus(wxString::FromUTF8("Authentification..."));

    auto result = std::make_shared<std::optional<user::domain::RegistrationResult>>();
    wxWeakRef<HomeFrame> weakSelf(this);

    lila::shared::ui::RunBackgroundTaskWithResult<user::domain::RegistrationResult>(
        this,
        [this, request = std::move(request)]()
        {
            return registerUseCase_.Execute(request);
        },
        [weakSelf](std::string errorMessage, std::optional<user::domain::RegistrationResult> result) mutable
        {
            if (!weakSelf)
            {
                return;
            }

            weakSelf->SetBusyState(false);
            if (!errorMessage.empty() || !result.has_value())
            {
                weakSelf->SetStatus(wxString::FromUTF8(lila::shared::errors::RegistrationFailed), true);
                return;
            }

            const auto& registrationResult = result.value();
            if (!registrationResult.success)
            {
                weakSelf->SetStatus(
                    registrationResult.message.empty()
                        ? wxString::FromUTF8(lila::shared::errors::RegistrationFailed)
                        : wxString::FromUTF8(registrationResult.message),
                    true);
                return;
            }

            weakSelf->SetStatus(wxString::FromUTF8("Chargement des données..."));
            weakSelf->loginUsernameInput_->SetValue(wxString::FromUTF8(registrationResult.username));
            weakSelf->loginPasswordInput_->Clear();
            weakSelf->loginPasswordTextInput_->Clear();
            weakSelf->registerPasswordInput_->Clear();
            weakSelf->registerPasswordTextInput_->Clear();
            weakSelf->SetStatus(wxString::FromUTF8("Compte créé, vous pouvez vous connecter."));
            weakSelf->ShowPage(Page::Login);
        });
}
}
