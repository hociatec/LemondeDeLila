#pragma once

#include <functional>

#include <wx/frame.h>

#include "shared/accessibility/application/FocusMemory.h"

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
    void SetContent(wxWindow* content);
    void RemoveContent(wxWindow* content);
    void SetPresenceRequestedHandler(PresenceRequestedHandler handler);
    void SetCloseRequestedHandler(CloseRequestedHandler handler);

private:
    void OnClose(wxCloseEvent& event);
    void OnCharHook(wxKeyEvent& event);
    void OnActivate(wxActivateEvent& event);
    void OnChildFocus(wxChildFocusEvent& event);
    void RestoreContentFocusAfterActivation();

    wxWindow* contentRoot_ = nullptr;
    wxWindow* currentContent_ = nullptr;
    lila::shared::accessibility::FocusMemory focusMemory_;
    PresenceRequestedHandler onPresenceRequested_;
    CloseRequestedHandler onCloseRequested_;
};
}
