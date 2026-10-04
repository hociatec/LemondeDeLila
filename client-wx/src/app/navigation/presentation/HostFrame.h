#pragma once

#include <cstddef>
#include <functional>
#include <string_view>

#include <wx/frame.h>

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
    void SetInterfaceTitle(std::string_view interfaceTitle);
    void SetContent(wxWindow* content);
    void RemoveContent(wxWindow* content);
    void SetPresenceRequestedHandler(PresenceRequestedHandler handler);
    void SetCloseRequestedHandler(CloseRequestedHandler handler);

private:
    void OnClose(wxCloseEvent& event);
    void OnCharHook(wxKeyEvent& event);
#ifdef __WXMSW__
    void OnActivate(wxActivateEvent& event);
    void ReannounceWindowTitle(std::size_t activationGeneration);
#endif

    wxWindow* contentRoot_ = nullptr;
    wxWindow* currentContent_ = nullptr;
    PresenceRequestedHandler onPresenceRequested_;
    CloseRequestedHandler onCloseRequested_;
#ifdef __WXMSW__
    std::size_t activationGeneration_ = 0;
#endif
};
}
