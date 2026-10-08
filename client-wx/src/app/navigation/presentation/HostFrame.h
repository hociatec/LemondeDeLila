#pragma once

#include <functional>
#include <string_view>

#include <wx/frame.h>
#ifdef __WXMSW__
#include <wx/weakref.h>
#endif

#include "shared/accessibility/presentation/ActivationFocusContext.h"

class wxBoxSizer;
class wxWindow;

namespace lila::app::navigation
{
class HostFrame final : public wxFrame
{
public:
    using PresenceRequestedHandler = std::function<void()>;
    using CloseRequestedHandler = std::function<bool()>;

    HostFrame();

    [[nodiscard]] wxWindow* ContentParent() const noexcept;
    void SetApplicationTitle(std::string_view username = {});
    void SetContent(wxWindow* content);
    void RemoveContent(wxWindow* content);
    void BeginInitialFocusAnnouncement();
    void CompleteInitialFocusAnnouncement();
    void ClearActivationFocusContext();
    void PrepareActivationFocusContext(wxWindow* target);
    void SetPresenceRequestedHandler(PresenceRequestedHandler handler);
    void SetCloseRequestedHandler(CloseRequestedHandler handler);

private:
    void OnClose(wxCloseEvent& event);
    void OnCharHook(wxKeyEvent& event);
#ifdef __WXMSW__
    void OnActivate(wxActivateEvent& event);
    void OnChildFocus(wxChildFocusEvent& event);
#endif

    wxWindow* contentRoot_ = nullptr;
    wxWindow* currentContent_ = nullptr;
    PresenceRequestedHandler onPresenceRequested_;
    CloseRequestedHandler onCloseRequested_;
#ifdef __WXMSW__
    wxWeakRef<wxWindow> lastFocusedChild_;
    wxString initialFocusTitle_;
    lila::shared::accessibility::ActivationFocusContext activationFocusContext_;
#endif
};
}
