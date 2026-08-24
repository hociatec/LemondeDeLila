#include "shared/text/Encoding.h"
#include "modules/main_menu/presentation/MainMenuFrame.h"

#include <wx/stattext.h>
#include <wx/string.h>

#include "modules/main_menu/presentation/MainMenuContent.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/FocusManager.h"
#include "shared/logging/Logger.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace
{
constexpr int WindowWidth = 960;
constexpr int WindowHeight = 640;

wxString ResolveStatusMessage(
    const lila::modules::options::application::OptionsStore& optionsStore,
    std::size_t index)
{
    const auto entries = lila::modules::main_menu::presentation::GetMainMenuEntries();
    if (index >= entries.size())
    {
        return wxString();
    }

    if (!optionsStore.Current().showNavigationStatus)
    {
        return wxString(L"Flèches haut/bas : naviguer. Entrée : sélectionner.");
    }

    return wxString(entries[index].statusMessage.data());
}
}

namespace lila::modules::main_menu::presentation
{
MainMenuFrame::MainMenuFrame(
    wxWindow* parent,
    lila::modules::session::application::SessionStore& sessionStore,
    lila::modules::options::application::OptionsStore& optionsStore,
    OpenCatalogRequestedHandler onOpenCatalogRequested,
    OpenAboutRequestedHandler onOpenAboutRequested,
    OpenChatRequestedHandler onOpenChatRequested,
    OpenSocialRequestedHandler onOpenSocialRequested,
    OpenOptionsRequestedHandler onOpenOptionsRequested,
    LogoutRequestedHandler onLogoutRequested,
    std::size_t initialSelectedIndex)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      sessionStore_(sessionStore),
      optionsStore_(optionsStore),
      onOpenCatalogRequested_(std::move(onOpenCatalogRequested)),
      onOpenAboutRequested_(std::move(onOpenAboutRequested)),
      onOpenChatRequested_(std::move(onOpenChatRequested)),
      onOpenSocialRequested_(std::move(onOpenSocialRequested)),
      onOpenOptionsRequested_(std::move(onOpenOptionsRequested)),
      onLogoutRequested_(std::move(onLogoutRequested))
{
    SetMinSize(wxSize(WindowWidth, WindowHeight));
    lila::shared::logging::LogInfo("MainMenu", "Constructor: begin.");
    BuildLayout();
    lila::shared::logging::LogInfo("MainMenu", "Constructor: BuildLayout done.");
    ApplyTheme();
    lila::shared::logging::LogInfo("MainMenu", "Constructor: ApplyTheme done.");
    BindEvents();
    lila::shared::logging::LogInfo("MainMenu", "Constructor: BindEvents done.");
    if (menu_ != nullptr && menu_->GetItemCount() > 0)
    {
        selectedMenuIndex_ = std::min(initialSelectedIndex, menu_->GetItemCount() - 1);
        menu_->SetSelectedIndexSilently(selectedMenuIndex_);
        SetStatus(ResolveStatusMessage(optionsStore_, selectedMenuIndex_), false);
    }
    lila::shared::logging::LogInfo("MainMenu", "Constructor: end.");
}

lila::shared::accessibility::FocusManager::Plan MainMenuFrame::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    if (menu_ == nullptr || menu_->GetItemCount() == 0)
    {
        return plan;
    }

    menu_->SetSelectedIndexSilently(selectedMenuIndex_);
    plan.AddWindow(menu_->GetSelectedControl());
    return plan;
}

void MainMenuFrame::SetStatus(const wxString& message, bool announce)
{
    statusLabel_->SetLabel(message);
    if (announce)
    {
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    }
    Layout();
}
}
