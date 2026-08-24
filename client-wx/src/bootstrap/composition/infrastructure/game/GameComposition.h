#pragma once

#include <memory>

#include "bootstrap/composition/application/StepLogger.h"

namespace lila::shared::network::realtime
{
class AuthenticatedRealtimeApiClient;
}

namespace lila::shared::network::websocket
{
class IWebSocketClient;
}

namespace lila::modules::catalog::application { class CatalogService; }
namespace lila::modules::catalog::infrastructure { class CatalogApi; }
namespace lila::modules::leaderboard::application { class LeaderboardService; }
namespace lila::modules::leaderboard::infrastructure { class LeaderboardApi; }
namespace lila::modules::gameplay::application { class GameSessionService; }
namespace lila::modules::gameplay::infrastructure { class GameSessionGateway; }
namespace lila::modules::rooms::application { class RoomLobbyService; class RoomSessionService; }
namespace lila::modules::rooms::infrastructure { class RoomLobbyApi; class RoomSessionGateway; }
namespace lila::modules::session::application { class SessionStore; }
namespace lila::modules::storybook::application { class StoryBookService; }
namespace lila::modules::storybook::infrastructure { class StoryBookApi; }
namespace lila::modules::vault::application { class VaultService; }
namespace lila::modules::vault::infrastructure { class VaultApi; }

namespace lila::bootstrap
{
struct NetworkComposition;

struct GameComposition final
{
    GameComposition();
    ~GameComposition();

    void Assemble(
        NetworkComposition& network,
        lila::modules::session::application::SessionStore& sessionStore,
        const StepLogger& setStep);

    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> catalogWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient> catalogRealtimeApiClient;
    std::unique_ptr<lila::modules::catalog::infrastructure::CatalogApi> catalogApi;
    std::unique_ptr<lila::modules::catalog::application::CatalogService> catalogService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> roomLobbyWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient> roomLobbyRealtimeApiClient;
    std::unique_ptr<lila::modules::rooms::infrastructure::RoomLobbyApi> roomLobbyApi;
    std::unique_ptr<lila::modules::rooms::application::RoomLobbyService> roomLobbyService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> roomSessionWebSocketClient;
    std::unique_ptr<lila::modules::rooms::infrastructure::RoomSessionGateway> roomSessionGateway;
    std::unique_ptr<lila::modules::rooms::application::RoomSessionService> roomSessionService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> gameSessionWebSocketClient;
    std::unique_ptr<lila::modules::gameplay::infrastructure::GameSessionGateway> gameSessionGateway;
    std::unique_ptr<lila::modules::gameplay::application::GameSessionService> gameSessionService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> vaultWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient> vaultRealtimeApiClient;
    std::unique_ptr<lila::modules::vault::infrastructure::VaultApi> vaultApi;
    std::unique_ptr<lila::modules::vault::application::VaultService> vaultService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> storyBookWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient> storyBookRealtimeApiClient;
    std::unique_ptr<lila::modules::storybook::infrastructure::StoryBookApi> storyBookApi;
    std::unique_ptr<lila::modules::storybook::application::StoryBookService> storyBookService;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> leaderboardWebSocketClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient> leaderboardRealtimeApiClient;
    std::unique_ptr<lila::modules::leaderboard::infrastructure::LeaderboardApi> leaderboardApi;
    std::unique_ptr<lila::modules::leaderboard::application::LeaderboardService> leaderboardService;
};
}
