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

namespace lila::modules::catalog::infrastructure
{
class CatalogApi;
}

namespace lila::modules::catalog::application
{
class CatalogService;
}

namespace lila::modules::rooms::infrastructure
{
class RoomLobbyApi;
class RoomSessionGateway;
}

namespace lila::modules::rooms::application
{
class RoomLobbyService;
class RoomSessionService;
}

namespace lila::modules::vault::infrastructure
{
class VaultApi;
}

namespace lila::modules::vault::application
{
class VaultService;
}

namespace lila::modules::storybook::infrastructure
{
class StoryBookApi;
}

namespace lila::modules::storybook::application
{
class StoryBookService;
}

namespace lila::modules::leaderboard::infrastructure
{
class LeaderboardApi;
}

namespace lila::modules::leaderboard::application
{
class LeaderboardService;
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

namespace lila::modules::presence::application
{
class PresenceMonitor;
}

namespace lila::bootstrap
{
using StepLogger = std::function<void(const char* step)>;

struct NetworkComposition final
{
    NetworkComposition();
    ~NetworkComposition();

    void Assemble(const StepLogger& setStep);

    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> realtimeWebSocketClient;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> authenticatedRealtimeWebSocketClient;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> presenceChatWebSocketClient;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> presenceWebSocketClient;
    std::unique_ptr<lila::shared::network::http::WsTicketProvider> wsTicketProvider;
    std::unique_ptr<lila::shared::network::realtime::RealtimeApiClient> realtimeApiClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient>
        authenticatedRealtimeApiClient;
};

struct UserComposition final
{
    UserComposition();
    ~UserComposition();

    void AssembleAuthentication(NetworkComposition& network, const StepLogger& setStep);
    void LoadLocalStores(const StepLogger& setStep);

    std::unique_ptr<lila::modules::user::infrastructure::remote::UserAuthRemoteDataSource>
        userAuthRemoteDataSource;
    std::unique_ptr<lila::modules::user::domain::IAuthenticationService> authenticationService;
    std::unique_ptr<lila::modules::user::application::LoginUseCase> loginUseCase;
    std::unique_ptr<lila::modules::user::application::RegisterUseCase> registerUseCase;
    std::unique_ptr<lila::modules::session::application::SessionStore> sessionStore;
    std::unique_ptr<lila::modules::options::application::OptionsStore> optionsStore;
};

struct GameComposition final
{
    GameComposition();
    ~GameComposition();

    void Assemble(NetworkComposition& network,
                  lila::modules::session::application::SessionStore& sessionStore,
                  const StepLogger& setStep);

    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> catalogWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient>
        catalogRealtimeApiClient;
    std::unique_ptr<lila::modules::catalog::infrastructure::CatalogApi> catalogApi;
    std::unique_ptr<lila::modules::catalog::application::CatalogService> catalogService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> roomLobbyWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient>
        roomLobbyRealtimeApiClient;
    std::unique_ptr<lila::modules::rooms::infrastructure::RoomLobbyApi> roomLobbyApi;
    std::unique_ptr<lila::modules::rooms::application::RoomLobbyService> roomLobbyService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> roomSessionWebSocketClient;
    std::unique_ptr<lila::modules::rooms::infrastructure::RoomSessionGateway> roomSessionGateway;
    std::unique_ptr<lila::modules::rooms::application::RoomSessionService> roomSessionService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> vaultWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient>
        vaultRealtimeApiClient;
    std::unique_ptr<lila::modules::vault::infrastructure::VaultApi> vaultApi;
    std::unique_ptr<lila::modules::vault::application::VaultService> vaultService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> storyBookWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient>
        storyBookRealtimeApiClient;
    std::unique_ptr<lila::modules::storybook::infrastructure::StoryBookApi> storyBookApi;
    std::unique_ptr<lila::modules::storybook::application::StoryBookService> storyBookService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> leaderboardWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient>
        leaderboardRealtimeApiClient;
    std::unique_ptr<lila::modules::leaderboard::infrastructure::LeaderboardApi> leaderboardApi;
    std::unique_ptr<lila::modules::leaderboard::application::LeaderboardService> leaderboardService;
};

struct SocialComposition final
{
    SocialComposition();
    ~SocialComposition();

    void Assemble(NetworkComposition& network,
                  lila::modules::session::application::SessionStore& sessionStore,
                  lila::modules::options::application::OptionsStore& optionsStore,
                  const StepLogger& setStep);

    std::unique_ptr<lila::modules::chat::infrastructure::PresenceChatGateway> chatGateway;
    std::unique_ptr<lila::modules::chat::infrastructure::ChatProtocol> chatProtocol;
    std::unique_ptr<lila::modules::chat::application::ChatService> chatService;
    std::unique_ptr<lila::modules::messaging::infrastructure::MessagingApi> messagingApi;
    std::unique_ptr<lila::modules::messaging::application::MessagingService> messagingService;
    std::unique_ptr<lila::modules::social::infrastructure::SocialApi> socialApi;
    std::unique_ptr<lila::modules::social::application::SocialService> socialService;
    std::unique_ptr<lila::modules::presence::application::PresenceMonitor> presenceMonitor;
};
}
