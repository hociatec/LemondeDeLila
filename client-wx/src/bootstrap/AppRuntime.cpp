#include "bootstrap/AppRuntime.h"

#include <memory>
#include <string>
#include <utility>

#include "app/navigation/AppNavigator.h"
#include "modules/chat/application/ChatService.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/chat/infrastructure/PresenceChatGateway.h"
#include "modules/messaging/application/MessagingService.h"
#include "modules/messaging/infrastructure/MessagingApi.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/infrastructure/FileOptionsRepository.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/infrastructure/FileSessionRepository.h"
#include "modules/social/application/SocialService.h"
#include "modules/social/infrastructure/SocialApi.h"
#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"
#include "modules/user/domain/IAuthenticationService.h"
#include "modules/user/infrastructure/WsAuthenticationService.h"
#include "modules/user/infrastructure/remote/UserAuthRemoteDataSource.h"
#include "shared/config/AppConfig.h"
#include "shared/network/WebSocketConstants.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/RealtimeApiClient.h"
#include "shared/network/websocket/IWebSocketClient.h"
#include "shared/network/websocket/WinHttpWebSocketClient.h"

namespace lila::bootstrap
{
namespace
{
std::unique_ptr<shared::network::websocket::IWebSocketClient> CreateWebSocketClient()
{
    return std::make_unique<shared::network::websocket::WinHttpWebSocketClient>();
}
}

AppRuntime::AppRuntime() = default;

AppRuntime::~AppRuntime() = default;

void AppRuntime::Assemble(const StepLogger& setStep)
{
    CreateTransportStack(setStep);
    CreateAuthenticationStack(setStep);
    LoadLocalStores(setStep);
    CreateChatStack(setStep);
    CreateMessagingStack(setStep);
    CreateSocialStack(setStep);
    CreateNavigator(setStep);
}

bool AppRuntime::StartNavigator() const
{
    return navigator_ != nullptr && navigator_->Start();
}

void AppRuntime::CreateTransportStack(const StepLogger& setStep)
{
    setStep("Création des transports réseau");
    realtimeWebSocketClient_ = CreateWebSocketClient();
    presenceChatWebSocketClient_ = CreateWebSocketClient();

    setStep("Création du fournisseur de tickets");
    wsTicketProvider_ = std::make_unique<shared::network::http::WsTicketProvider>(
        shared::config::AppConfig::ResolveBackendApiWs());

    setStep("Création du client temps-réel");
    shared::network::websocket::WebSocketHeaders realtimeHeaders;
    realtimeHeaders.emplace(std::string(shared::network::ws::ClientVersionHeader), shared::config::AppConfig::ResolveClientVersion());
    realtimeApiClient_ = std::make_unique<shared::network::realtime::RealtimeApiClient>(
        shared::config::AppConfig::ResolveBackendApiWs(),
        std::move(realtimeHeaders),
        *realtimeWebSocketClient_);

    setStep("Création du client temps-réel authentifié");
    authenticatedRealtimeApiClient_ = std::make_unique<shared::network::realtime::AuthenticatedRealtimeApiClient>(
        shared::config::AppConfig::ResolveBackendApiWs(),
        shared::config::AppConfig::ResolveClientVersion(),
        *realtimeWebSocketClient_,
        *wsTicketProvider_);
}

void AppRuntime::CreateAuthenticationStack(const StepLogger& setStep)
{
    setStep("Création des services d'authentification");
    userAuthRemoteDataSource_ =
        std::make_unique<modules::user::infrastructure::remote::UserAuthRemoteDataSource>(*realtimeApiClient_);
    authenticationService_ =
        std::make_unique<modules::user::infrastructure::WsAuthenticationService>(*userAuthRemoteDataSource_);
    loginUseCase_ = std::make_unique<modules::user::application::LoginUseCase>(*authenticationService_);
    registerUseCase_ = std::make_unique<modules::user::application::RegisterUseCase>(*authenticationService_);
}

void AppRuntime::LoadLocalStores(const StepLogger& setStep)
{
    setStep("Chargement des options");
    optionsStore_ = std::make_unique<modules::options::application::OptionsStore>(
        std::make_unique<modules::options::infrastructure::FileOptionsRepository>());
    optionsStore_->Load();

    setStep("Création du store de session");
    sessionStore_ = std::make_unique<modules::session::application::SessionStore>(
        std::make_unique<modules::session::infrastructure::FileSessionRepository>());
}

void AppRuntime::CreateChatStack(const StepLogger& setStep)
{
    setStep("Création du gateway chat");
    chatGateway_ = std::make_unique<modules::chat::infrastructure::PresenceChatGateway>(
        shared::config::AppConfig::ResolvePresenceWs() +
            std::string(shared::network::ws::PresenceContextQuery) +
            std::string(shared::network::ws::PresenceContextChat),
        *presenceChatWebSocketClient_,
        *wsTicketProvider_);

    setStep("Création du protocole chat");
    chatProtocol_ = std::make_unique<modules::chat::infrastructure::ChatProtocol>();

    setStep("Création du service chat");
    chatService_ = std::make_unique<modules::chat::application::ChatService>(
        *chatGateway_,
        *chatProtocol_,
        *sessionStore_,
        *optionsStore_);
}

void AppRuntime::CreateMessagingStack(const StepLogger& setStep)
{
    setStep("Création du service messagerie");
    messagingApi_ = std::make_unique<modules::messaging::infrastructure::MessagingApi>(
        *authenticatedRealtimeApiClient_,
        *sessionStore_);
    messagingService_ = std::make_unique<modules::messaging::application::MessagingService>(*messagingApi_);
}

void AppRuntime::CreateSocialStack(const StepLogger& setStep)
{
    setStep("Création du service social");
    socialApi_ = std::make_unique<modules::social::infrastructure::SocialApi>(
        *authenticatedRealtimeApiClient_,
        *sessionStore_);
    socialService_ = std::make_unique<modules::social::application::SocialService>(*socialApi_);
}

void AppRuntime::CreateNavigator(const StepLogger& setStep)
{
    setStep("Création du navigateur");
    navigator_ = std::make_unique<app::navigation::AppNavigator>(
        *loginUseCase_,
        *registerUseCase_,
        *sessionStore_,
        *optionsStore_,
        *chatService_,
        *messagingService_,
        *socialService_,
        *wsTicketProvider_);
}
}
