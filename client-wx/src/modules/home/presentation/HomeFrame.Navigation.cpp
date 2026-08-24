#include "modules/home/presentation/HomeFrame.h"

#include <wx/checkbox.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/presentation/ActionButton.h"
#include "shared/accessibility/application/FocusManager.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::home::presentation
{
lila::shared::accessibility::NavigationController::Scope HomeFrame::BuildCurrentTabScope() const
{
    using Navigator = lila::shared::accessibility::NavigationController;
    Navigator::Scope scope;

    switch (currentPage_)
    {
    case Page::Landing:
        scope.Add({landingLoginButton_, landingRegisterButton_, landingQuitButton_});
        break;
    case Page::Login:
        scope.Add({
            loginUsernameInput_,
            loginPasswordInput_,
            loginPasswordTextInput_,
            loginShowPasswordCheck_,
            loginRememberMeCheck_,
            loginSubmitButton_,
            loginRegisterButton_,
            loginQuitButton_});
        break;
    case Page::Register:
        scope.Add({
            registerUsernameInput_,
            registerEmailInput_,
            registerPasswordInput_,
            registerPasswordTextInput_,
            registerShowPasswordCheck_,
            registerSubmitButton_,
            registerBackButton_});
        break;
    }

    return scope;
}

void HomeFrame::PrepareForLogout()
{
    isBusy_ = false;
    SetFormInteractivity(Page::Login, true);
    loginPasswordInput_->Clear();
    loginPasswordTextInput_->Clear();
    SetStatus(wxEmptyString);
    currentPage_ = Page::Login;
    pages_->SetSelection(1);
    Layout();
    StartAuthenticationWarmUp();
}

void HomeFrame::ShowPage(Page page)
{
    currentPage_ = page;

    switch (page)
    {
    case Page::Landing:
        pages_->SetSelection(0);
        break;
    case Page::Login:
        pages_->SetSelection(1);
        break;
    case Page::Register:
        pages_->SetSelection(2);
        break;
    }

    Layout();
    lila::shared::accessibility::FocusCoordinator::Schedule(
        *this,
        [this]() { return BuildFocusPlan(); });
}

void HomeFrame::SetStatus(const wxString& message, bool isError)
{
    statusLabel_->Show(!message.empty());
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(isError ? shared::ui::Theme::Error() : shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    cardPanel_->Layout();
}

lila::shared::accessibility::FocusManager::Plan HomeFrame::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;

    switch (currentPage_)
    {
    case Page::Landing:
        plan.AddWindow(landingLoginButton_);
        break;
    case Page::Login:
        plan.AddResolver(
            [this]() -> wxWindow*
            {
                loginUsernameInput_->SelectAll();
                return loginUsernameInput_;
            });
        break;
    case Page::Register:
        plan.AddResolver(
            [this]() -> wxWindow*
            {
                registerUsernameInput_->SelectAll();
                return registerUsernameInput_;
            });
        break;
    }

    return plan;
}

void HomeFrame::ToggleLoginPasswordMode()
{
    const bool show = loginShowPasswordCheck_->GetValue();
    if (show)
    {
        loginPasswordTextInput_->SetValue(loginPasswordInput_->GetValue());
        loginPasswordInput_->Hide();
        loginPasswordTextInput_->Show();
    }
    else
    {
        loginPasswordInput_->SetValue(loginPasswordTextInput_->GetValue());
        loginPasswordTextInput_->Hide();
        loginPasswordInput_->Show();
    }

    loginPage_->Layout();
}

void HomeFrame::ToggleRegisterPasswordMode()
{
    const bool show = registerShowPasswordCheck_->GetValue();
    if (show)
    {
        registerPasswordTextInput_->SetValue(registerPasswordInput_->GetValue());
        registerPasswordInput_->Hide();
        registerPasswordTextInput_->Show();
    }
    else
    {
        registerPasswordInput_->SetValue(registerPasswordTextInput_->GetValue());
        registerPasswordTextInput_->Hide();
        registerPasswordInput_->Show();
    }

    registerPage_->Layout();
}
}
