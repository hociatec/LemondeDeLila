#pragma once

#include <functional>
#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"

class wxCommandEvent;
class wxStaticText;
class wxWindow;

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::shared::ui::controls { class VerticalMenu; }

namespace lila::modules::main_menu::presentation
{
class MainMenuFrame final : public lila::shared::accessibility::NonFocusablePanel, public lila::shared::accessibility::FocusPlanView
{
public:
    using LogoutRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenCatalogRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenAboutRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenChatRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenSocialRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenOptionsRequestedHandler = std::function<void(std::size_t selectedIndex)>;

    MainMenuFrame(
        wxWindow* parent,
        lila::modules::session::application::SessionStore& sessionStore,
        lila::modules::options::application::OptionsStore& optionsStore,
        OpenCatalogRequestedHandler onOpenCatalogRequested,
        OpenAboutRequestedHandler onOpenAboutRequested,
        OpenChatRequestedHandler onOpenChatRequested,
        OpenSocialRequestedHandler onOpenSocialRequested,
        OpenOptionsRequestedHandler onOpenOptionsRequested,
        LogoutRequestedHandler onLogoutRequested,
        std::size_t initialSelectedIndex = 0);
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    void BuildLayout();
    void ApplyTheme();
    void BindEvents();
    void OnLogoutClicked(wxCommandEvent& event);
    void OnMenuSelectionChanged(std::size_t index);
    void OnMenuActivated(std::size_t index);
    void SetStatus(const wxString& message, bool announce = true);

    lila::modules::session::application::SessionStore& sessionStore_;
    lila::modules::options::application::OptionsStore& optionsStore_;
    OpenCatalogRequestedHandler onOpenCatalogRequested_;
    OpenAboutRequestedHandler onOpenAboutRequested_;
    OpenChatRequestedHandler onOpenChatRequested_;
    OpenSocialRequestedHandler onOpenSocialRequested_;
    OpenOptionsRequestedHandler onOpenOptionsRequested_;
    LogoutRequestedHandler onLogoutRequested_;
    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* welcomeLabel_ = nullptr;
    wxStaticText* navigationLabel_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    std::size_t selectedMenuIndex_ = 0;
    wxStaticText* statusLabel_ = nullptr;
    wxStaticText* versionLabel_ = nullptr;
};
}
