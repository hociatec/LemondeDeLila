#include "bootstrap/composition/infrastructure/game/GameComposition.h"

#include <memory>
#include <utility>

#include "bootstrap/composition/infrastructure/network/NetworkComposition.h"
#include "bootstrap/composition/infrastructure/support/AuthenticatedServiceFactory.h"
#include "modules/catalog/application/CatalogService.h"
#include "modules/catalog/infrastructure/CatalogApi.h"
#include "modules/gameplay/session/application/GameSessionService.h"
#include "modules/gameplay/session/infrastructure/GameSessionGateway.h"
#include "modules/leaderboard/application/LeaderboardService.h"
#include "modules/leaderboard/infrastructure/LeaderboardApi.h"
#include "modules/rooms/application/RoomLobbyService.h"
#include "modules/rooms/application/RoomInvitationMonitor.h"
#include "modules/rooms/application/RoomSessionService.h"
#include "modules/rooms/infrastructure/RoomLobbyApi.h"
#include "modules/rooms/infrastructure/RoomSessionGateway.h"
#include "modules/session/application/SessionStore.h"
#include "modules/storybook/application/StoryBookService.h"
#include "modules/storybook/infrastructure/StoryBookApi.h"
#include "modules/vault/application/VaultService.h"
#include "modules/vault/infrastructure/VaultApi.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/network/domain/UrlUtils.h"

namespace lila::bootstrap
{
GameComposition::GameComposition() = default;
GameComposition::~GameComposition() = default;

void GameComposition::Assemble(
    NetworkComposition& network,
    modules::session::application::SessionStore& sessionStore,
    const StepLogger& setStep)
{
    setStep("Creation du service catalogue");
    catalogWebSocketClient = detail::CreateWebSocketClient();
    shared::network::websocket::WebSocketHeaders catalogHeaders;
    catalogHeaders.emplace(
        std::string(shared::network::ws::ClientProductHeader),
        std::string(shared::network::ws::ClientProduct));
    catalogHeaders.emplace(
        std::string(shared::network::ws::ClientVersionHeader),
        shared::config::AppConfig::ResolveClientVersion());
    catalogRealtimeApiClient =
        std::make_unique<shared::network::realtime::RealtimeApiClient>(
            shared::config::AppConfig::ResolveBackendApiWs(),
            std::move(catalogHeaders),
            *catalogWebSocketClient);
    catalogApi = std::make_unique<modules::catalog::infrastructure::CatalogApi>(
        *catalogRealtimeApiClient);
    catalogService = std::make_unique<modules::catalog::application::CatalogService>(
        *catalogApi);

    roomInvitationWebSocketClient = detail::CreateWebSocketClient();
    roomInvitationMonitor = std::make_unique<modules::rooms::application::RoomInvitationMonitor>(
        shared::network::ExtractOrigin(shared::config::AppConfig::ResolveBackendApiWs()) +
            std::string(shared::network::ws::NotifyPath),
        *roomInvitationWebSocketClient,
        *network.wsTicketProvider,
        sessionStore);

    setStep("Creation des services de tables");
    detail::CreateAuthenticatedServiceStack(
        roomLobbyWebSocketClient,
        roomLobbyRealtimeApiClient,
        roomLobbyApi,
        roomLobbyService,
        *network.wsTicketProvider,
        sessionStore);

    roomSessionWebSocketClient = detail::CreateWebSocketClient();
    const auto roomEndpoint =
        shared::network::ExtractOrigin(shared::config::AppConfig::ResolveBackendApiWs()) + "/ws";
    roomSessionGateway = std::make_unique<modules::rooms::infrastructure::RoomSessionGateway>(
        roomEndpoint,
        *roomSessionWebSocketClient,
        *network.wsTicketProvider,
        sessionStore);
    roomSessionService =
        std::make_unique<modules::rooms::application::RoomSessionService>(*roomSessionGateway);

    gameSessionWebSocketClient = detail::CreateWebSocketClient();
    const auto gameEndpoint =
        shared::network::ExtractOrigin(shared::config::AppConfig::ResolveBackendApiWs()) +
        std::string(shared::network::ws::GamePath);
    gameSessionGateway = std::make_unique<modules::gameplay::infrastructure::GameSessionGateway>(
        gameEndpoint,
        *gameSessionWebSocketClient,
        *network.wsTicketProvider,
        sessionStore);
    gameSessionService =
        std::make_unique<modules::gameplay::application::GameSessionService>(*gameSessionGateway);

    setStep("Creation du service coffre fort");
    detail::CreateAuthenticatedServiceStack(
        vaultWebSocketClient,
        vaultRealtimeApiClient,
        vaultApi,
        vaultService,
        *network.wsTicketProvider,
        sessionStore);

    setStep("Creation du service livre des contes");
    detail::CreateAuthenticatedServiceStack(
        storyBookWebSocketClient,
        storyBookRealtimeApiClient,
        storyBookApi,
        storyBookService,
        *network.wsTicketProvider,
        sessionStore);

    setStep("Creation du service classement");
    detail::CreateAuthenticatedServiceStack(
        leaderboardWebSocketClient,
        leaderboardRealtimeApiClient,
        leaderboardApi,
        leaderboardService,
        *network.wsTicketProvider,
        sessionStore);
}
}
