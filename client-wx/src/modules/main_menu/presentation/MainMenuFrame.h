#pragma once

#include <functional>

#include <wx/frame.h>

class wxCommandEvent;
class wxStaticText;

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::shared::ui::controls
{
class VerticalMenu;
}

namespace lila::modules::main_menu::presentation
{
class MainMenuFrame final : public wxFrame
{
public:
    using LogoutRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenAboutRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenChatRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenSocialRequestedHandler = std::function<void(std::size_t selectedIndex)>;
    using OpenOptionsRequestedHandler = std::function<void(std::size_t selectedIndex)>;

    MainMenuFrame(
        lila::modules::session::application::SessionStore& sessionStore,
        lila::modules::options::application::OptionsStore& optionsStore,
        OpenAboutRequestedHandler onOpenAboutRequested,
        OpenChatRequestedHandler onOpenChatRequested,
    OpenSocialRequestedHandler onOpenSocialRequested,
    OpenOptionsRequestedHandler onOpenOptionsRequested,
    LogoutRequestedHandler onLogoutRequested,
    std::size_t initialSelectedIndex = 0);

private:
    void BuildLayout();
    void ApplyTheme();
    void BindEvents();
    void OnLogoutClicked(wxCommandEvent& event);
    void OnMenuSelectionChanged(std::size_t index);
    void OnMenuActivated(std::size_t index);
    void SetStatus(const wxString& message);

    lila::modules::session::application::SessionStore& sessionStore_;
    lila::modules::options::application::OptionsStore& optionsStore_;
    OpenAboutRequestedHandler onOpenAboutRequested_;
    OpenChatRequestedHandler onOpenChatRequested_;
    OpenSocialRequestedHandler onOpenSocialRequested_;
    OpenOptionsRequestedHandler onOpenOptionsRequested_;
    LogoutRequestedHandler onLogoutRequested_;
    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* welcomeLabel_ = nullptr;
    wxStaticText* navigationLabel_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    wxStaticText* versionLabel_ = nullptr;
};
}
