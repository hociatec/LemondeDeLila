#pragma once

#include <functional>
#include <memory>

namespace lila::shared::network::websocket
{
class IWebSocketClient;
}

namespace lila::shared::network::http
{
class WsTicketProvider;
}

namespace lila::shared::network::realtime
{
class AuthenticatedRealtimeApiClient;
class RealtimeApiClient;
}

namespace lila::modules::user::infrastructure::remote
{
class UserAuthRemoteDataSource;
}

namespace lila::modules::user::domain
{
class IAuthenticationService;
}

namespace lila::modules::user::application
{
class LoginUseCase;
class RegisterUseCase;
}

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::chat::infrastructure
{
class PresenceChatGateway;
class ChatProtocol;
}

namespace lila::modules::chat::application
{
class ChatService;
}

namespace lila::modules::messaging::infrastructure
{
class MessagingApi;
}

namespace lila::modules::messaging::application
{
class MessagingService;
}

namespace lila::modules::social::infrastructure
{
class SocialApi;
}

namespace lila::modules::social::application
{
class SocialService;
}

namespace lila::app::navigation
{
class AppNavigator;
}

namespace lila::bootstrap
{
class AppRuntime final
{
public:
    using StepLogger = std::function<void(const char* step)>;

    AppRuntime();
    ~AppRuntime();

    void Assemble(const StepLogger& setStep);
    bool StartNavigator() const;

private:
    void CreateTransportStack(const StepLogger& setStep);
    void CreateAuthenticationStack(const StepLogger& setStep);
    void LoadLocalStores(const StepLogger& setStep);
    void CreateChatStack(const StepLogger& setStep);
    void CreateMessagingStack(const StepLogger& setStep);
    void CreateSocialStack(const StepLogger& setStep);
    void CreateNavigator(const StepLogger& setStep);

    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> realtimeWebSocketClient_;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> presenceChatWebSocketClient_;
    std::unique_ptr<lila::shared::network::http::WsTicketProvider> wsTicketProvider_;
    std::unique_ptr<lila::shared::network::realtime::RealtimeApiClient> realtimeApiClient_;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient> authenticatedRealtimeApiClient_;
    std::unique_ptr<lila::modules::user::infrastructure::remote::UserAuthRemoteDataSource> userAuthRemoteDataSource_;
    std::unique_ptr<lila::modules::user::domain::IAuthenticationService> authenticationService_;
    std::unique_ptr<lila::modules::user::application::LoginUseCase> loginUseCase_;
    std::unique_ptr<lila::modules::user::application::RegisterUseCase> registerUseCase_;
    std::unique_ptr<lila::modules::session::application::SessionStore> sessionStore_;
    std::unique_ptr<lila::modules::options::application::OptionsStore> optionsStore_;
    std::unique_ptr<lila::modules::chat::infrastructure::PresenceChatGateway> chatGateway_;
    std::unique_ptr<lila::modules::chat::infrastructure::ChatProtocol> chatProtocol_;
    std::unique_ptr<lila::modules::chat::application::ChatService> chatService_;
    std::unique_ptr<lila::modules::messaging::infrastructure::MessagingApi> messagingApi_;
    std::unique_ptr<lila::modules::messaging::application::MessagingService> messagingService_;
    std::unique_ptr<lila::modules::social::infrastructure::SocialApi> socialApi_;
    std::unique_ptr<lila::modules::social::application::SocialService> socialService_;
    std::unique_ptr<lila::app::navigation::AppNavigator> navigator_;
};
}
