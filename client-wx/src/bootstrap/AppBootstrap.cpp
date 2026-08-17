#include "bootstrap/AppBootstrap.h"

#include "app/navigation/AppNavigator.h"
#include "modules/chat/application/ChatService.h"
#include "modules/chat/infrastructure/PresenceChatGateway.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/messaging/application/MessagingService.h"
#include "modules/messaging/infrastructure/MessagingApi.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/infrastructure/FileOptionsRepository.h"
#include "modules/session/infrastructure/FileSessionRepository.h"
#include "modules/social/application/SocialService.h"
#include "modules/social/infrastructure/SocialApi.h"
#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"
#include "modules/session/application/SessionStore.h"
#include "modules/user/domain/IAuthenticationService.h"
#include "modules/user/infrastructure/remote/UserAuthRemoteDataSource.h"
#include "modules/user/infrastructure/WsAuthenticationService.h"
#include "shared/config/AppConfig.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/RealtimeApiClient.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/network/websocket/WinHttpWebSocketClient.h"

#include <wx/msgdlg.h>

#include <exception>

namespace lila::bootstrap
{
AppBootstrap::AppBootstrap() = default;

AppBootstrap::~AppBootstrap() = default;

bool AppBootstrap::Start()
{
    try
    {
        webSocketClient_ = std::make_unique<shared::network::websocket::WinHttpWebSocketClient>();
        chatWebSocketClient_ = std::make_unique<shared::network::websocket::WinHttpWebSocketClient>();
        wsTicketProvider_ = std::make_unique<shared::network::http::WsTicketProvider>(
            shared::config::AppConfig::ResolveBackendApiWs());
        shared::network::websocket::WebSocketHeaders realtimeHeaders;
        realtimeHeaders.emplace(std::string(shared::contracts::ws::ClientVersionHeader), shared::config::AppConfig::ResolveClientVersion());
        realtimeApiClient_ = std::make_unique<shared::network::realtime::RealtimeApiClient>(
            shared::config::AppConfig::ResolveBackendApiWs(),
            std::move(realtimeHeaders),
            *webSocketClient_);
        authenticatedRealtimeApiClient_ = std::make_unique<shared::network::realtime::AuthenticatedRealtimeApiClient>(
            shared::config::AppConfig::ResolveBackendApiWs(),
            shared::config::AppConfig::ResolveClientVersion(),
            *webSocketClient_,
            *wsTicketProvider_);
        userAuthRemoteDataSource_ =
            std::make_unique<modules::user::infrastructure::remote::UserAuthRemoteDataSource>(*realtimeApiClient_);
        authenticationService_ =
            std::make_unique<modules::user::infrastructure::WsAuthenticationService>(*userAuthRemoteDataSource_);
        loginUseCase_ = std::make_unique<modules::user::application::LoginUseCase>(*authenticationService_);
        registerUseCase_ = std::make_unique<modules::user::application::RegisterUseCase>(*authenticationService_);
        optionsStore_ = std::make_unique<modules::options::application::OptionsStore>(
            std::make_unique<modules::options::infrastructure::FileOptionsRepository>());
        optionsStore_->Load();
        sessionStore_ = std::make_unique<modules::session::application::SessionStore>(
            std::make_unique<modules::session::infrastructure::FileSessionRepository>());
        chatGateway_ = std::make_unique<modules::chat::infrastructure::PresenceChatGateway>(
            shared::config::AppConfig::ResolvePresenceWs() +
                std::string(shared::contracts::ws::PresenceContextQuery) +
                std::string(shared::contracts::ws::PresenceContextChat),
            *chatWebSocketClient_,
            *wsTicketProvider_);
        chatProtocol_ = std::make_unique<modules::chat::infrastructure::ChatProtocol>();
        chatService_ = std::make_unique<modules::chat::application::ChatService>(
            *chatGateway_,
            *chatProtocol_,
            *sessionStore_,
            *optionsStore_);
        messagingApi_ = std::make_unique<modules::messaging::infrastructure::MessagingApi>(
            *authenticatedRealtimeApiClient_,
            *sessionStore_);
        messagingService_ = std::make_unique<modules::messaging::application::MessagingService>(*messagingApi_);
        socialApi_ = std::make_unique<modules::social::infrastructure::SocialApi>(
            *authenticatedRealtimeApiClient_,
            *sessionStore_);
        socialService_ = std::make_unique<modules::social::application::SocialService>(*socialApi_);
        navigator_ = std::make_unique<app::navigation::AppNavigator>(
            *loginUseCase_,
            *registerUseCase_,
            *sessionStore_,
            *optionsStore_,
            *chatService_,
            *messagingService_,
            *socialService_,
            *wsTicketProvider_);
        return navigator_->Start();
    }
    catch (const std::exception& error)
    {
        wxMessageBox(
            wxString::FromUTF8(error.what()),
            wxString(L"Erreur de démarrage"),
            wxOK | wxICON_ERROR);
        return false;
    }
}
}
