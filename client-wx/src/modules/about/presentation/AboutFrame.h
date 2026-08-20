#pragma once

#include <functional>
#include <memory>

#include <wx/frame.h>

#include "shared/accessibility/NavigationController.h"

class wxButton;
namespace lila::shared::ui::controls
{
class VerticalMenu;
}
class wxStaticText;
class wxTextCtrl;

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::about::presentation
{
class AboutPageCoordinator;

class AboutFrame final : public wxFrame
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;

    AboutFrame(
        lila::modules::session::application::SessionStore& sessionStore,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);
    ~AboutFrame() override;

private:
    [[nodiscard]] lila::shared::accessibility::NavigationController::Scope BuildTabScope() const;
    void BuildLayout();
    void ApplyTheme();
    void BindEvents();
    void HandleEscape();
    void UpdateStatus(const wxString& message);

    lila::modules::session::application::SessionStore& sessionStore_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    std::unique_ptr<AboutPageCoordinator> pageCoordinator_;
    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* detailsLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* itemsList_ = nullptr;
    wxTextCtrl* shortcutsTextCtrl_ = nullptr;
    wxTextCtrl* contactMessageCtrl_ = nullptr;
    wxButton* sendContactButton_ = nullptr;
    wxButton* cancelContactButton_ = nullptr;

    friend class AboutPageCoordinator;
};
}
