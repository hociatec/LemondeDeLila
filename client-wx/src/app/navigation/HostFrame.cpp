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
          wxDEFAULT_FRAME_STYLE)
{
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
