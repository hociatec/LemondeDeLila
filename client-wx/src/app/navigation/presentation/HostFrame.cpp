#include "app/navigation/presentation/HostFrame.h"
#include "app/navigation/presentation/ApplicationTitle.h"

#include <utility>

#include <wx/event.h>
#include <wx/panel.h>
#include <wx/sizer.h>

#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/text/presentation/encoding/Encoding.h"

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
          lila::shared::text::FromUtf8(ApplicationTitle()),
          wxDefaultPosition,
          wxSize(HostWindowWidth, HostWindowHeight),
          wxDEFAULT_FRAME_STYLE)
{
#ifdef __WXMSW__
    screenReader_ = lila::shared::accessibility::CreateScreenReaderAnnouncer();
#endif
    Bind(wxEVT_CLOSE_WINDOW, &HostFrame::OnClose, this);
    Bind(wxEVT_CHAR_HOOK, &HostFrame::OnCharHook, this);
#ifdef __WXMSW__
    Bind(wxEVT_ACTIVATE, &HostFrame::OnActivate, this);
    Bind(wxEVT_CHILD_FOCUS, &HostFrame::OnChildFocus, this);
#endif
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

void HostFrame::SetApplicationTitle(std::string_view username)
{
    SetTitle(lila::shared::text::FromUtf8(ApplicationTitle(username)));
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
    ClearActivationFocusContext();
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

void HostFrame::ClearActivationFocusContext()
{
#ifdef __WXMSW__
    activationFocusContext_.Clear();
#endif
}

void HostFrame::PrepareActivationFocusContext(wxWindow* target)
{
#ifdef __WXMSW__
    activationFocusContext_.Prepare(
        target, initialFocusTitle_.empty() ? GetTitle() : initialFocusTitle_);
#else
    static_cast<void>(target);
#endif
}

void HostFrame::SetContent(wxWindow* content)
{
    ClearActivationFocusContext();
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
    ClearActivationFocusContext();
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
