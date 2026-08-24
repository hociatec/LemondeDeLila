#include "modules/home/presentation/HomeFrame.h"

#include <wx/checkbox.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "shared/accessibility/ActionButton.h"
#include "shared/accessibility/NavigationController.h"

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

    using Navigator = lila::shared::accessibility::NavigationController;
    Navigator::BindTabNavigation(
        *this,
        [this]() { return BuildCurrentTabScope(); });

    Navigator::BindVerticalNavigation(
        *this,
        [this]()
        {
            Navigator::Scope scope;
            scope.Add({landingLoginButton_, landingRegisterButton_, landingQuitButton_});
            return scope;
        },
        {},
        Navigator::Boundary::Wrap);

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
    if (wxWindow* top = wxGetTopLevelParent(this))
    {
        top->Close(true);
    }
}
}
