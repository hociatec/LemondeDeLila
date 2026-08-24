#include "bootstrap/composition/infrastructure/game/GameComposition.h"

#include <memory>

#include "bootstrap/composition/infrastructure/network/NetworkComposition.h"
#include "bootstrap/composition/infrastructure/support/AuthenticatedServiceFactory.h"
#include "modules/catalog/application/CatalogService.h"
#include "modules/catalog/infrastructure/CatalogApi.h"
#include "modules/leaderboard/application/LeaderboardService.h"
#include "modules/leaderboard/infrastructure/LeaderboardApi.h"
#include "modules/rooms/application/RoomLobbyService.h"
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
#include "shared/network/application/websocket/IWebSocketClient.h"
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
    detail::CreateAuthenticatedServiceStack(
        catalogWebSocketClient,
        catalogRealtimeApiClient,
        catalogApi,
        catalogService,
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
