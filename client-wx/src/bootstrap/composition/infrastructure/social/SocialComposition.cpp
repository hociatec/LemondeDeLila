#include "bootstrap/composition/infrastructure/social/SocialComposition.h"

#include <memory>
#include <string>

#include "bootstrap/composition/infrastructure/network/NetworkComposition.h"
#include "modules/audio/application/IAudioService.h"
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
#include "shared/config/domain/AppConfig.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/WebSocketConstants.h"

namespace lila::bootstrap
{
SocialComposition::SocialComposition() = default;
SocialComposition::~SocialComposition() = default;

void SocialComposition::Assemble(
    NetworkComposition& network,
    modules::session::application::SessionStore& sessionStore,
    modules::options::application::OptionsStore& optionsStore,
    modules::audio::application::IAudioService& audioService,
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
        optionsStore,
        audioService);

    setStep("Creation du service messagerie");
    messagingApi = std::make_unique<modules::messaging::infrastructure::MessagingApi>(
        *network.authenticatedRealtimeApiClient,
        sessionStore);
    messagingService =
        std::make_unique<modules::messaging::application::MessagingService>(
            *messagingApi,
            audioService);

    setStep("Creation du service social");
    socialApi = std::make_unique<modules::social::infrastructure::SocialApi>(
        *network.authenticatedRealtimeApiClient,
        sessionStore);
    socialService = std::make_unique<modules::social::application::SocialService>(
        *socialApi,
        audioService);

    setStep("Creation du service presence");
    presenceMonitor = std::make_unique<modules::presence::application::PresenceMonitor>(
        shared::config::AppConfig::ResolvePresenceWs(),
        *network.presenceWebSocketClient,
        *network.wsTicketProvider,
        sessionStore,
        audioService,
        [service = socialService.get()](int userId)
        {
            return service != nullptr && service->IsFriendCached(userId);
        });
}
}
