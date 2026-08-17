#include "modules/main_menu/presentation/MainMenuFrame.h"

#include <algorithm>
#include <wx/stattext.h>
#include <wx/string.h>
#include <wx/window.h>

#include "modules/main_menu/presentation/MainMenuContent.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/config/AppConfig.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace
{
constexpr int WindowWidth = 960;
constexpr int WindowHeight = 640;
}

namespace lila::modules::main_menu::presentation
{
MainMenuFrame::MainMenuFrame(
    lila::modules::session::application::SessionStore& sessionStore,
    lila::modules::options::application::OptionsStore& optionsStore,
    OpenAboutRequestedHandler onOpenAboutRequested,
    OpenChatRequestedHandler onOpenChatRequested,
    OpenSocialRequestedHandler onOpenSocialRequested,
    OpenOptionsRequestedHandler onOpenOptionsRequested,
    LogoutRequestedHandler onLogoutRequested,
    std::size_t initialSelectedIndex)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              "Menu principal - %s",
              wxString::FromUTF8(shared::config::AppConfig::AppTitle.data())),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
      wxDEFAULT_FRAME_STYLE),
      sessionStore_(sessionStore),
      optionsStore_(optionsStore),
      onOpenAboutRequested_(std::move(onOpenAboutRequested)),
      onOpenChatRequested_(std::move(onOpenChatRequested)),
      onOpenSocialRequested_(std::move(onOpenSocialRequested)),
      onOpenOptionsRequested_(std::move(onOpenOptionsRequested)),
      onLogoutRequested_(std::move(onLogoutRequested))
{
    BuildLayout();
    ApplyTheme();
    BindEvents();
    if (menu_ != nullptr)
    {
        menu_->SetTabNavigationEnabled(false);
        const auto itemCount = menu_->GetItemCount();
        if (itemCount > 0)
        {
            const auto boundedIndex = std::min(initialSelectedIndex, static_cast<std::size_t>(itemCount - 1));
            menu_->SetSelectedIndex(boundedIndex);
            OnMenuSelectionChanged(boundedIndex);
        }
    }
    CallAfter(
        [this]()
        {
            if (menu_ != nullptr)
            {
                menu_->SetFocus();
            }
        });
    CentreOnScreen();
}

void MainMenuFrame::SetStatus(const wxString& message)
{
    statusLabel_->SetLabel(message);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}
}
