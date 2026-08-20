#include "shared/text/Encoding.h"
#include "modules/about/presentation/AboutFrame.h"
#include "modules/about/presentation/AboutPageCoordinator.h"

#include <utility>

#include <wx/button.h>
#include <wx/textctrl.h>

#include "modules/session/application/SessionStore.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace
{
constexpr int WindowWidth = 960;
constexpr int WindowHeight = 700;
}

namespace lila::modules::about::presentation
{
AboutFrame::~AboutFrame() = default;

lila::shared::accessibility::NavigationController::Scope AboutFrame::BuildTabScope() const
{
    using Navigator = lila::shared::accessibility::NavigationController;
    Navigator::Scope scope;
    if (itemsList_ != nullptr && itemsList_->IsShown())
    {
        scope.Add(static_cast<wxWindow*>(itemsList_));
        return scope;
    }

    if (shortcutsTextCtrl_ != nullptr && shortcutsTextCtrl_->IsShown())
    {
        scope.Add(static_cast<wxWindow*>(shortcutsTextCtrl_));
        return scope;
    }

    if (contactMessageCtrl_ != nullptr && contactMessageCtrl_->GetParent() != nullptr && contactMessageCtrl_->GetParent()->IsShown())
    {
        scope.Add({
            static_cast<wxWindow*>(contactMessageCtrl_),
            static_cast<wxWindow*>(sendContactButton_),
            static_cast<wxWindow*>(cancelContactButton_)});
    }

    return scope;
}

AboutFrame::AboutFrame(
    lila::modules::session::application::SessionStore& sessionStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString(L"À propos - ") + lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data()),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      sessionStore_(sessionStore),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    BuildLayout();
    pageCoordinator_ = std::make_unique<AboutPageCoordinator>(
        *this,
        sessionStore_,
        AboutPageCoordinator::Callbacks{
            [this](const wxString& message)
            {
                UpdateStatus(message);
            },
            [this]()
            {
                if (onCloseRequested_)
                {
                    onCloseRequested_();
                }
            }});
    ApplyTheme();
    BindEvents();
    if (itemsList_ != nullptr)
    {
        itemsList_->SetTabNavigationEnabled(false);
    }
    pageCoordinator_->ShowPage(AboutPageCoordinator::Page::Root);
    CentreOnScreen();
    CallAfter(
        [this]()
        {
            pageCoordinator_->FocusCurrentPage();
        });
}
}
