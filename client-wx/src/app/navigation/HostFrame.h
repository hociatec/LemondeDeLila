#pragma once

#include <functional>

#include <wx/frame.h>
#include <wx/timer.h>

class wxBoxSizer;
class wxWindow;

namespace lila::app::navigation
{
class HostFrame final : public wxFrame
{
public:
    using PresenceRequestedHandler = std::function<void()>;

    HostFrame();

    [[nodiscard]] wxWindow* ContentParent() const noexcept;
    void SetContent(wxWindow* content);
    void RemoveContent(wxWindow* content);
    void ScheduleContentFocus(std::function<void()> focusAction, int delayMilliseconds);
    void SetPresenceRequestedHandler(PresenceRequestedHandler handler);

private:
    void CancelScheduledContentFocus();
    void OnClose(wxCloseEvent& event);
    void OnContentFocusTimer(wxTimerEvent& event);
    void OnCharHook(wxKeyEvent& event);

    wxWindow* contentRoot_ = nullptr;
    wxWindow* currentContent_ = nullptr;
    wxTimer contentFocusTimer_;
    std::function<void()> pendingContentFocus_;
    PresenceRequestedHandler onPresenceRequested_;
};
}
