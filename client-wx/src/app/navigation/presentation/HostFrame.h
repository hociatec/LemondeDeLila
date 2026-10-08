#pragma once

#include <functional>
#include <memory>
#include <string_view>

#include <wx/frame.h>
#ifdef __WXMSW__
#include <wx/weakref.h>
#endif

#include "shared/accessibility/presentation/ActivationFocusContext.h"
#include "shared/accessibility/application/IScreenReaderAnnouncer.h"

class wxBoxSizer;
class wxWindow;

namespace lila::shared::concurrency
{
class BackgroundTaskHandle;
}

namespace lila::app::navigation
{
namespace concurrency = lila::shared::concurrency;

class HostFrame final : public wxFrame
{
public:
    using PresenceRequestedHandler = std::function<void()>;
    using CloseRequestedHandler = std::function<bool()>;
    using InitialFocusHandler = std::function<void()>;

    HostFrame();

    [[nodiscard]] wxWindow* ContentParent() const noexcept;
    void SetApplicationTitle(std::string_view username = {});
    void SetContent(wxWindow* content);
    void RemoveContent(wxWindow* content);
    void BeginInitialFocusAnnouncement();
    void CompleteInitialFocusAnnouncement(InitialFocusHandler focusWhenFinished);
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
    std::shared_ptr<lila::shared::accessibility::IScreenReaderAnnouncer> screenReader_;
    std::shared_ptr<concurrency::BackgroundTaskHandle> initialAnnouncementTask_;
    lila::shared::accessibility::ActivationFocusContext activationFocusContext_;
#endif
};
}
