#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/about/presentation/AboutFrame.h"
#include "modules/about/presentation/AboutPageCoordinator.h"

#include <utility>

#include <wx/button.h>
#include <wx/window.h>
#include <wx/textctrl.h>

#include "modules/session/application/SessionStore.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

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
    wxWindow* parent,
    lila::modules::session::application::SessionStore& sessionStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : lila::shared::accessibility::NonFocusablePanel(
          parent,
          0),
      sessionStore_(sessionStore),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    SetMinSize(wxSize(WindowWidth, WindowHeight));
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
    }
    pageCoordinator_->InitializeRootPage();
}

lila::shared::accessibility::FocusManager::Plan AboutFrame::BuildFocusPlan()
{
    if (pageCoordinator_ != nullptr)
    {
        return pageCoordinator_->BuildCurrentPageFocusPlan();
    }
    return {};
}
}
