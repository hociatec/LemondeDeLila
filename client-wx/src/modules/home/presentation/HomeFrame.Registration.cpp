#include "modules/home/presentation/HomeFrame.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/text/presentation/encoding/Encoding.h"

#include <memory>

#include <wx/app.h>
#include <wx/checkbox.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>

#include "modules/home/application/HomeAuthValidator.h"
#include "modules/user/application/RegisterUseCase.h"
#include "modules/user/domain/RegistrationResult.h"
#include "modules/user/domain/RegisterRequest.h"
#include "shared/accessibility/presentation/ActionButton.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/ui/application/BackgroundTask.h"

namespace lila::modules::home::presentation
{
void HomeFrame::OnRegisterSubmit(wxCommandEvent& event)
{
    (void)event;

    if (isBusy_)
    {
        SetStatus(lila::shared::text::FromUtf8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    user::domain::RegisterRequest request;
    request.username = lila::shared::text::ToUtf8(registerUsernameInput_->GetValue());
    request.email = lila::shared::text::ToUtf8(registerEmailInput_->GetValue());
    request.password = registerShowPasswordCheck_->GetValue()
        ? lila::shared::text::ToUtf8(registerPasswordTextInput_->GetValue())
        : lila::shared::text::ToUtf8(registerPasswordInput_->GetValue());

    if (const auto validationError = application::HomeAuthValidator::ValidateRegistration(
            request.username,
            request.email,
            request.password))
    {
        SetStatus(lila::shared::text::FromUtf8(*validationError), true);
        return;
    }

    SetBusyState(true);

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
                weakSelf->SetStatus(lila::shared::text::FromUtf8(lila::shared::errors::RegistrationFailed), true);
                return;
            }

            const auto& registrationResult = result.value();
            if (!registrationResult.success)
            {
                weakSelf->SetStatus(
                    registrationResult.message.empty()
                        ? lila::shared::text::FromUtf8(lila::shared::errors::RegistrationFailed)
                        : lila::shared::text::FromUtf8(registrationResult.message),
                    true);
                return;
            }

            weakSelf->SetStatus(lila::shared::text::FromUtf8("Chargement des données..."));
            weakSelf->loginUsernameInput_->SetValue(lila::shared::text::FromUtf8(registrationResult.username));
            weakSelf->loginPasswordInput_->Clear();
            weakSelf->loginPasswordTextInput_->Clear();
            weakSelf->registerPasswordInput_->Clear();
            weakSelf->registerPasswordTextInput_->Clear();
            weakSelf->SetStatus(lila::shared::text::FromUtf8("Compte créé, vous pouvez vous connecter."));
            weakSelf->ShowPage(Page::Login);
        });
}
}

