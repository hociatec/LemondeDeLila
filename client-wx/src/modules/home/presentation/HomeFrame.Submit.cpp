#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/home/presentation/HomeFrame.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/ui/application/BackgroundTask.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "modules/user/domain/UserErrorMessages.h"
#include "shared/logging/application/Logger.h"

#include <chrono>
#include <memory>
#include <thread>

#include <wx/checkbox.h>
#include <wx/app.h>
#include <wx/weakref.h>
#include <wx/textctrl.h>

#include "shared/accessibility/presentation/ActionButton.h"
#include "modules/home/application/HomeAuthValidator.h"
#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"
#include "modules/user/domain/LoginCredentials.h"
#include "modules/user/domain/RegistrationResult.h"
#include "modules/user/domain/RegisterRequest.h"

namespace lila::modules::home::presentation
{
void HomeFrame::StartAuthenticationWarmUp()
{
    auto* loginUseCase = &loginUseCase_;
    static_cast<void>(lila::shared::concurrency::RunAsync(
        [loginUseCase](std::stop_token stopToken)
        {
            if (!stopToken.stop_requested())
            {
                loginUseCase->WarmUp();
            }
        },
        {},
        lila::shared::concurrency::BackgroundTaskPriority::Low));
}
void HomeFrame::SetBusyState(bool isBusy, const wxString& statusMessage)
{
    isBusy_ = isBusy;

    // Ne pas désactiver les contrôles pendant l'authentification :
    // le lecteur d'écran annonce sinon "indisponible" sur le contrôle focalisé.
    if (!isBusy)
    {
        SetFormInteractivity(Page::Landing, true);
        SetFormInteractivity(Page::Login, true);
        SetFormInteractivity(Page::Register, true);
    }

    if (!statusMessage.empty())
    {
        SetStatus(statusMessage, false);
    }

    if (!isBusy)
    {
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
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
        SetStatus(lila::shared::text::FromUtf8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    user::domain::LoginCredentials credentials;
    credentials.username = lila::shared::text::ToUtf8(loginUsernameInput_->GetValue());
    credentials.password = loginShowPasswordCheck_->GetValue()
        ? lila::shared::text::ToUtf8(loginPasswordTextInput_->GetValue())
        : lila::shared::text::ToUtf8(loginPasswordInput_->GetValue());

    if (const auto validationError = application::HomeAuthValidator::ValidateLogin(credentials.username, credentials.password))
    {
        SetStatus(lila::shared::text::FromUtf8(*validationError), true);
        return;
    }

    const bool rememberSession = loginRememberMeCheck_->GetValue();
    SetBusyState(true);

    wxWeakRef<HomeFrame> weakSelf(this);

    lila::shared::ui::RunBackgroundTaskWithResult<user::domain::AuthenticationResult>(
        this,
        [this, credentials = std::move(credentials)]()
        {
            const auto startedAt = std::chrono::steady_clock::now();
            auto result = loginUseCase_.Execute(credentials);
            const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - startedAt);
            lila::shared::logging::LogInfo(
                "Authentication",
                "Login request completed in " + std::to_string(elapsed.count()) + " ms.");
            return result;
        },
        [weakSelf, rememberSession](std::string errorMessage, std::optional<user::domain::AuthenticationResult> result) mutable
        {
            if (!weakSelf)
            {
                return;
            }

            if (!errorMessage.empty() || !result.has_value())
            {
                weakSelf->SetBusyState(false);
                weakSelf->SetStatus(lila::shared::text::FromUtf8(lila::shared::errors::AuthenticationFailed), true);
                return;
            }

            const auto& loginResult = result.value();
            if (!loginResult.success)
            {
                weakSelf->SetBusyState(false);
                weakSelf->SetStatus(
                    loginResult.message.empty()
                        ? lila::shared::text::FromUtf8(lila::shared::errors::AuthenticationFailed)
                        : wxString::Format(
                            wxString(L"%s %s"),
                            lila::shared::text::FromUtf8(lila::shared::errors::AuthenticationFailed),
                            lila::shared::text::FromUtf8(loginResult.message)),
                    true);
                return;
            }

            auto forwardedResult = loginResult;
            forwardedResult.rememberSession = rememberSession;
            // The form stays enabled while authenticating, so a successful login only
            // needs to release the submission guard before switching views. Applying
            // the home focus plan here would briefly move focus back to the login form.
            weakSelf->isBusy_ = false;
            if (weakSelf->onLoginSucceeded_)
            {
                weakSelf->onLoginSucceeded_(forwardedResult);
            }
        });
}
}
