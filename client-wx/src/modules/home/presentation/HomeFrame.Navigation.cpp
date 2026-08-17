#include "modules/home/presentation/HomeFrame.h"

#include <wx/checkbox.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/ActionButton.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/ui/Theme.h"

namespace lila::modules::home::presentation
{
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
    CallAfter([this]()
    {
        FocusCurrentPagePrimaryField();
    });
}

void HomeFrame::SetStatus(const wxString& message, bool isError)
{
    statusLabel_->Show(!message.empty());
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(isError ? shared::ui::Theme::Error() : shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    cardPanel_->Layout();
}

void HomeFrame::FocusCurrentPagePrimaryField()
{
    switch (currentPage_)
    {
    case Page::Landing:
        landingLoginButton_->SetFocus();
        break;
    case Page::Login:
        loginUsernameInput_->SetFocus();
        loginUsernameInput_->SelectAll();
        break;
    case Page::Register:
        registerUsernameInput_->SetFocus();
        registerUsernameInput_->SelectAll();
        break;
    }
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
