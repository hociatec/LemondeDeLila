#include "bootstrap/AppCompositions.h"

#include <memory>
#include <string>

#include "modules/chat/application/ChatService.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/chat/infrastructure/PresenceChatGateway.h"
#include "modules/messaging/application/MessagingService.h"
#include "modules/messaging/infrastructure/MessagingApi.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/presence/application/PresenceMonitor.h"
#include "modules/session/application/SessionStore.h"
#include "modules/social/application/SocialService.h"
#include "modules/social/infrastructure/SocialApi.h"
#include "shared/config/AppConfig.h"
#include "shared/network/WebSocketConstants.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/websocket/IWebSocketClient.h"

namespace lila::bootstrap
{
SocialComposition::SocialComposition() = default;
SocialComposition::~SocialComposition() = default;

void SocialComposition::Assemble(
    NetworkComposition& network,
    modules::session::application::SessionStore& sessionStore,
    modules::options::application::OptionsStore& optionsStore,
    const StepLogger& setStep)
{
    setStep("Creation du gateway chat");
    chatGateway = std::make_unique<modules::chat::infrastructure::PresenceChatGateway>(
        shared::config::AppConfig::ResolvePresenceWs() +
            std::string(shared::network::ws::PresenceContextQuery) +
            std::string(shared::network::ws::PresenceContextChat),
        *network.presenceChatWebSocketClient,
        *network.wsTicketProvider);

    setStep("Creation du protocole chat");
    chatProtocol = std::make_unique<modules::chat::infrastructure::ChatProtocol>();

    setStep("Creation du service chat");
    chatService = std::make_unique<modules::chat::application::ChatService>(
        *chatGateway,
        *chatProtocol,
        sessionStore,
        optionsStore);

    setStep("Creation du service messagerie");
    messagingApi = std::make_unique<modules::messaging::infrastructure::MessagingApi>(
        *network.authenticatedRealtimeApiClient,
        sessionStore);
    messagingService =
        std::make_unique<modules::messaging::application::MessagingService>(*messagingApi);

    setStep("Creation du service social");
    socialApi = std::make_unique<modules::social::infrastructure::SocialApi>(
        *network.authenticatedRealtimeApiClient,
        sessionStore);
    socialService = std::make_unique<modules::social::application::SocialService>(*socialApi);

    setStep("Creation du service presence");
    presenceMonitor = std::make_unique<modules::presence::application::PresenceMonitor>(
        shared::config::AppConfig::ResolvePresenceWs(),
        *network.presenceWebSocketClient,
        *network.wsTicketProvider,
        sessionStore);
}
}
