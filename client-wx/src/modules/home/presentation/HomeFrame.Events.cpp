#include "modules/home/presentation/HomeFrame.h"

#include <array>

#include <wx/checkbox.h>
#include <wx/event.h>
#include <wx/textctrl.h>

#include "shared/accessibility/ActionButton.h"

namespace lila::modules::home::presentation
{
void HomeFrame::BindEvents()
{
    landingLoginButton_->Bind(wxEVT_BUTTON, &HomeFrame::OnShowLogin, this);
    landingRegisterButton_->Bind(wxEVT_BUTTON, &HomeFrame::OnShowRegister, this);
    landingQuitButton_->Bind(wxEVT_BUTTON, &HomeFrame::OnQuit, this);
    loginRegisterButton_->Bind(wxEVT_BUTTON, &HomeFrame::OnShowRegister, this);
    loginQuitButton_->Bind(wxEVT_BUTTON, &HomeFrame::OnQuit, this);
    registerBackButton_->Bind(wxEVT_BUTTON, &HomeFrame::OnShowLanding, this);
    loginSubmitButton_->Bind(wxEVT_BUTTON, &HomeFrame::OnLoginSubmit, this);
    registerSubmitButton_->Bind(wxEVT_BUTTON, &HomeFrame::OnRegisterSubmit, this);
    loginUsernameInput_->Bind(wxEVT_TEXT_ENTER, &HomeFrame::OnLoginSubmit, this);
    loginPasswordInput_->Bind(wxEVT_TEXT_ENTER, &HomeFrame::OnLoginSubmit, this);
    loginPasswordTextInput_->Bind(wxEVT_TEXT_ENTER, &HomeFrame::OnLoginSubmit, this);
    registerUsernameInput_->Bind(wxEVT_TEXT_ENTER, &HomeFrame::OnRegisterSubmit, this);
    registerEmailInput_->Bind(wxEVT_TEXT_ENTER, &HomeFrame::OnRegisterSubmit, this);
    registerPasswordInput_->Bind(wxEVT_TEXT_ENTER, &HomeFrame::OnRegisterSubmit, this);
    registerPasswordTextInput_->Bind(wxEVT_TEXT_ENTER, &HomeFrame::OnRegisterSubmit, this);
    loginShowPasswordCheck_->Bind(wxEVT_CHECKBOX, [this](wxCommandEvent&) { ToggleLoginPasswordMode(); });
    registerShowPasswordCheck_->Bind(wxEVT_CHECKBOX, [this](wxCommandEvent&) { ToggleRegisterPasswordMode(); });

    const auto bindLandingNavigation = [this](lila::shared::accessibility::ActionButton& button, std::size_t index)
    {
        button.Bind(
            wxEVT_CHAR_HOOK,
            [this, index](wxKeyEvent& event)
            {
                static const std::array<lila::shared::accessibility::ActionButton*, 3> buttons = {
                    landingLoginButton_,
                    landingRegisterButton_,
                    landingQuitButton_,
                };

                switch (event.GetKeyCode())
                {
                case WXK_TAB:
                    return;
                case WXK_UP:
                case WXK_NUMPAD_UP:
                    buttons[index == 0 ? buttons.size() - 1 : index - 1]->SetFocus();
                    return;
                case WXK_DOWN:
                case WXK_NUMPAD_DOWN:
                    buttons[(index + 1) % buttons.size()]->SetFocus();
                    return;
                default:
                    event.Skip();
                    return;
                }
            });
    };

    bindLandingNavigation(*landingLoginButton_, 0);
    bindLandingNavigation(*landingRegisterButton_, 1);
    bindLandingNavigation(*landingQuitButton_, 2);
}

void HomeFrame::OnShowLogin(wxCommandEvent& event)
{
    (void)event;
    SetStatus(wxEmptyString);
    ShowPage(Page::Login);
}

void HomeFrame::OnShowRegister(wxCommandEvent& event)
{
    (void)event;
    SetStatus(wxEmptyString);
    ShowPage(Page::Register);
}

void HomeFrame::OnShowLanding(wxCommandEvent& event)
{
    (void)event;
    SetStatus(wxEmptyString);
    ShowPage(Page::Landing);
}

void HomeFrame::OnQuit(wxCommandEvent& event)
{
    (void)event;
    Close(true);
}
}
