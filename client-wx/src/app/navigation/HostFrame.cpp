#include "app/navigation/HostFrame.h"

#include <utility>

#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/event.h>

#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/config/AppConfig.h"
#include "shared/text/Encoding.h"

namespace
{
constexpr int HostWindowWidth = 1280;
constexpr int HostWindowHeight = 800;
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
      contentFocusTimer_(this)
{
    Bind(wxEVT_TIMER, &HostFrame::OnContentFocusTimer, this, contentFocusTimer_.GetId());
    Bind(wxEVT_CLOSE_WINDOW, &HostFrame::OnClose, this);
    Bind(wxEVT_CHAR_HOOK, &HostFrame::OnCharHook, this);
    contentRoot_ = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    rootSizer->Add(contentRoot_, 1, wxEXPAND);
    SetSizer(rootSizer);
    CentreOnScreen();
}

void HostFrame::OnClose(wxCloseEvent& event)
{
    CancelScheduledContentFocus();
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

void HostFrame::OnCharHook(wxKeyEvent& event)
{
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

void HostFrame::SetContent(wxWindow* content)
{
    CancelScheduledContentFocus();
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

    Freeze();
    if (currentContent_ != nullptr && currentContent_ != content)
    {
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
    Layout();
    Thaw();
}

void HostFrame::ScheduleContentFocus(std::function<void()> focusAction, int delayMilliseconds)
{
    CancelScheduledContentFocus();
    if (!focusAction)
    {
        return;
    }

    pendingContentFocus_ = std::move(focusAction);
    contentFocusTimer_.StartOnce(delayMilliseconds);
}

void HostFrame::CancelScheduledContentFocus()
{
    contentFocusTimer_.Stop();
    pendingContentFocus_ = {};
}

void HostFrame::OnContentFocusTimer(wxTimerEvent& event)
{
    (void)event;
    auto focusAction = std::move(pendingContentFocus_);
    pendingContentFocus_ = {};
    if (focusAction)
    {
        focusAction();
    }
}

void HostFrame::RemoveContent(wxWindow* content)
{
    CancelScheduledContentFocus();
    if (contentRoot_ == nullptr || content == nullptr)
    {
        return;
    }

    auto* sizer = contentRoot_->GetSizer();
    if (sizer == nullptr)
    {
        return;
    }

    Freeze();
    if (currentContent_ == content)
    {
        currentContent_->Hide();
        currentContent_ = nullptr;
    }
    else
    {
        content->Hide();
    }

    sizer->Detach(content);
    contentRoot_->Layout();
    Layout();
    Thaw();
}
}
