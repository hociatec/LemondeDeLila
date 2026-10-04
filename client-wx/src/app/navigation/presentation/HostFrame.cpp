#include "app/navigation/presentation/HostFrame.h"

#include <utility>

#include <wx/event.h>
#include <wx/panel.h>
#include <wx/sizer.h>

#include "shared/accessibility/presentation/NavigationController.h"
#include "shared/accessibility/presentation/FocusCoordinator.h"
#include "shared/accessibility/presentation/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace
{
constexpr int HostWindowWidth = 1280;
constexpr int HostWindowHeight = 800;
// Let the screen reader finish the window title before a restored child focus
// produces its own announcement after Alt+Tab.
constexpr int ActivationFocusDelayMs = 1500;
}

namespace lila::app::navigation
{
HostFrame::HostFrame()
    : wxFrame(
          nullptr,
          wxID_ANY,
          lila::shared::text::FromUtf8(lila::shared::config::AppConfig::AppTitle.data()),
          wxDefaultPosition,
          wxSize(HostWindowWidth, HostWindowHeight),
          wxDEFAULT_FRAME_STYLE),
      activationFocusTimer_(this)
{
    Bind(wxEVT_CLOSE_WINDOW, &HostFrame::OnClose, this);
    Bind(wxEVT_CHAR_HOOK, &HostFrame::OnCharHook, this);
    Bind(wxEVT_ACTIVATE, &HostFrame::OnActivate, this);
    Bind(wxEVT_TIMER, &HostFrame::OnActivationFocusTimer, this,
        activationFocusTimer_.GetId());
    Bind(wxEVT_CHILD_FOCUS, &HostFrame::OnChildFocus, this);
    contentRoot_ = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    rootSizer->Add(contentRoot_, 1, wxEXPAND);
    SetSizer(rootSizer);
    CentreOnScreen();
}

void HostFrame::OnClose(wxCloseEvent& event)
{
    if (event.CanVeto() && onCloseRequested_ && !onCloseRequested_())
    {
        event.Veto();
        return;
    }
    Hide();
    event.Skip();
}

wxWindow* HostFrame::ContentParent() const noexcept
{
    return contentRoot_;
}

void HostFrame::SetPresenceRequestedHandler(PresenceRequestedHandler handler)
{
    onPresenceRequested_ = std::move(handler);
}

void HostFrame::SetCloseRequestedHandler(CloseRequestedHandler handler)
{
    onCloseRequested_ = std::move(handler);
}

void HostFrame::OnCharHook(wxKeyEvent& event)
{
    // A key pressed after activation is an explicit user focus decision.  A
    // delayed restoration must never move focus again underneath that input.
    CancelActivationFocusRestore();
    const int key = event.GetKeyCode();
    if (event.ControlDown() && (key == 'U' || key == 'u'))
    {
        if (onPresenceRequested_)
        {
            onPresenceRequested_();
        }
        event.Skip(false);
        return;
    }
    event.Skip();
}

void HostFrame::OnActivate(wxActivateEvent& event)
{
    if (!event.GetActive())
    {
        activationFocusTimer_.Stop();
        focusMemory_.Remember(currentContent_);
        restoreFocusAfterActivation_ = true;
        event.Skip();
        return;
    }

    if (restoreFocusAfterActivation_)
        activationFocusTimer_.StartOnce(ActivationFocusDelayMs);
    event.Skip();
}

void HostFrame::OnActivationFocusTimer(wxTimerEvent&)
{
    RestoreContentFocusAfterActivation();
}

void HostFrame::CancelActivationFocusRestore()
{
    activationFocusTimer_.Stop();
    restoreFocusAfterActivation_ = false;
}

void HostFrame::OnChildFocus(wxChildFocusEvent& event)
{
    // Windows can temporarily focus the frame or its first child while an
    // application is being reactivated. Do not let that transient focus
    // overwrite the control remembered when the application lost focus.
    if (!restoreFocusAfterActivation_)
        focusMemory_.Remember(currentContent_);
    event.Skip();
}

void HostFrame::RestoreContentFocusAfterActivation()
{
    if (!IsActive())
        return;
    if (currentContent_ == nullptr || !currentContent_->IsShownOnScreen())
    {
        restoreFocusAfterActivation_ = false;
        return;
    }

    auto* focused = wxWindow::FindFocus();

    // Windows usually keeps the child focus across Alt+Tab. Reapplying the
    // same logical focus (or replacing another valid child focus) generates a
    // fresh accessibility event that interrupts NVDA while it reads the window
    // title. Only restore our remembered target when Windows left no usable
    // focus inside the active view.
    if (focused != nullptr && focused->IsShownOnScreen() &&
        focused->IsEnabled() && focused->AcceptsFocus() &&
        lila::shared::accessibility::NavigationController::IsDescendantOf(
            focused, currentContent_))
    {
        restoreFocusAfterActivation_ = false;
        return;
    }

    if (restoreFocusAfterActivation_)
    {
        restoreFocusAfterActivation_ = false;
        if (focusMemory_.Restore(currentContent_))
            return;
    }

    if (focusMemory_.Restore(currentContent_))
        return;

    auto* focusView =
        dynamic_cast<lila::shared::accessibility::FocusPlanView*>(currentContent_);
    if (focusView != nullptr)
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(
            focusView->BuildFocusPlan()));
}

void HostFrame::SetContent(wxWindow* content)
{
    if (contentRoot_ == nullptr)
    {
        return;
    }
    auto* sizer = contentRoot_->GetSizer();
    if (sizer == nullptr)
    {
        sizer = new wxBoxSizer(wxVERTICAL);
        contentRoot_->SetSizer(sizer);
    }
    if (currentContent_ != nullptr && currentContent_ != content)
    {
        focusMemory_.Forget(currentContent_);
        currentContent_->Hide();
    }

    currentContent_ = content;
    if (currentContent_ != nullptr)
    {
        if (sizer->GetItem(currentContent_) == nullptr)
        {
            sizer->Add(currentContent_, 1, wxEXPAND);
        }
        currentContent_->Show();
    }
    contentRoot_->Layout();
}

void HostFrame::RemoveContent(wxWindow* content)
{
    if (contentRoot_ == nullptr || content == nullptr)
    {
        return;
    }
    auto* sizer = contentRoot_->GetSizer();
    if (sizer == nullptr)
    {
        return;
    }
    if (currentContent_ == content)
    {
        focusMemory_.Forget(currentContent_);
        currentContent_->Hide();
        currentContent_ = nullptr;
    }
    else
    {
        content->Hide();
    }
    sizer->Detach(content);
    contentRoot_->Layout();
}
}
