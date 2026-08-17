#pragma once

#include <memory>

#include "modules/user/domain/AuthenticationResult.h"

class wxFrame;

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::chat::application
{
class ChatService;
}

namespace lila::modules::social::application
{
class SocialService;
}

namespace lila::modules::messaging::application
{
class MessagingService;
}

namespace lila::shared::network::http
{
class WsTicketProvider;
}

namespace lila::modules::user::application
{
class LoginUseCase;
class RegisterUseCase;
}

namespace lila::app::navigation
{
class AppNavigator final
{
public:
    AppNavigator(
        lila::modules::user::application::LoginUseCase& loginUseCase,
        lila::modules::user::application::RegisterUseCase& registerUseCase,
        lila::modules::session::application::SessionStore& sessionStore,
        lila::modules::options::application::OptionsStore& optionsStore,
        lila::modules::chat::application::ChatService& chatService,
        lila::modules::messaging::application::MessagingService& messagingService,
        lila::modules::social::application::SocialService& socialService,
        lila::shared::network::http::WsTicketProvider& wsTicketProvider);

    bool Start();

private:
    void ShowHome();
    void ShowSession(std::size_t selectedIndex = 0);
    void ShowChat(std::size_t selectedIndex);
    void ShowMessaging(std::size_t selectedIndex);
    void ShowMessagingFromSocial(std::size_t socialMenuIndex);
    void ShowSocial(std::size_t selectedIndex, std::size_t socialMenuIndex = 0);
    void ShowAbout(std::size_t selectedIndex);
    void ShowOptions(std::size_t selectedIndex);
    void CloseApplication();
    void ReplaceWindow(wxFrame* nextWindow);
    void OnLoginSucceeded(const lila::modules::user::domain::AuthenticationResult& result);
    void OnLogoutRequested(std::size_t selectedIndex);

    lila::modules::user::application::LoginUseCase& loginUseCase_;
    lila::modules::user::application::RegisterUseCase& registerUseCase_;
    lila::modules::session::application::SessionStore& sessionStore_;
    lila::modules::options::application::OptionsStore& optionsStore_;
    lila::modules::chat::application::ChatService& chatService_;
    lila::modules::messaging::application::MessagingService& messagingService_;
    lila::modules::social::application::SocialService& socialService_;
    lila::shared::network::http::WsTicketProvider& wsTicketProvider_;
    wxFrame* currentWindow_ = nullptr;
    std::size_t lastMainMenuSelection_ = 0;
    std::size_t lastSocialMenuSelection_ = 0;
};
}
