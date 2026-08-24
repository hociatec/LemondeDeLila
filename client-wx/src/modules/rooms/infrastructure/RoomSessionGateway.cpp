#include "modules/rooms/infrastructure/RoomSessionGateway.h"

#include <stdexcept>
#include <utility>
#include <nlohmann/json.hpp>
#include "modules/rooms/infrastructure/RoomProtocol.h"
#include "modules/session/application/SessionStore.h"
#include "shared/config/AppConfig.h"
#include "shared/network/WebSocketConstants.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/websocket/IWebSocketClient.h"

namespace lila::modules::rooms::infrastructure
{
RoomSessionGateway::RoomSessionGateway(
    std::string endpoint,
    lila::shared::network::websocket::IWebSocketClient& client,
    lila::shared::network::http::IWsTicketProvider& ticketProvider,
    lila::modules::session::application::SessionStore& sessionStore)
    : endpoint_(std::move(endpoint)), client_(client), ticketProvider_(ticketProvider), sessionStore_(sessionStore) {}

void RoomSessionGateway::Connect()
{
    if (!sessionStore_.HasActiveSession()) throw std::runtime_error("Aucune session active pour la table.");
    std::scoped_lock sendLock(sendMutex_);
    client_.Close();
    const auto& token = sessionStore_.Current().token;
    const auto ticket = ticketProvider_.GetTicket(
        std::string(lila::shared::network::ws::WsTicketScopeRoom),
        token);
    lila::shared::network::websocket::WebSocketHeaders headers{
        {std::string(lila::shared::network::ws::AuthorizationHeader),
         std::string(lila::shared::network::ws::AuthorizationScheme) + token},
        {std::string(lila::shared::network::ws::WsTicketHeader), ticket},
        {std::string(lila::shared::network::ws::ClientVersionHeader),
         lila::shared::config::AppConfig::ResolveClientVersion()}};
    client_.Connect(endpoint_, headers);
}

void RoomSessionGateway::SendJson(const nlohmann::json& message)
{
    std::scoped_lock sendLock(sendMutex_);
    if (!client_.IsConnected()) throw std::runtime_error("Aucune table active.");
    client_.Send(message.dump());
}

domain::RoomState RoomSessionGateway::Create(std::string_view gameType, std::stop_token stopToken)
{
    if (gameType.empty()) throw std::invalid_argument("gameType requis");
    Connect();
    SendJson(nlohmann::json{
        {"type", protocol::Create},
        {"payload", {{"gameType", std::string(gameType)}}}});
    selfSpectator_.store(false);
    auto state = AwaitState(stopToken);
    roomId_.store(state.id);
    return state;
}

domain::RoomState RoomSessionGateway::Join(int roomId, bool spectator, std::stop_token stopToken)
{
    if (roomId <= 0) throw std::invalid_argument("roomId invalide");
    Connect();
    SendJson(nlohmann::json{{"type", protocol::Join},
        {"payload", {{"roomId", roomId}, {"spectator", spectator}, {"hidden", false}}}});
    selfSpectator_.store(spectator);
    auto state = AwaitState(stopToken);
    roomId_.store(state.id);
    return state;
}

domain::RoomState RoomSessionGateway::Reconnect(std::stop_token stopToken)
{
    const auto roomId = roomId_.load();
    const auto spectator = selfSpectator_.load();
    if (roomId <= 0) throw std::runtime_error("Aucune table active.");
    if (stopToken.stop_requested()) throw std::runtime_error("Reconnexion interrompue.");

    Interrupt();
    {
        std::scoped_lock lock(pendingEventsMutex_);
        pendingEvents_.clear();
    }
    Connect();
    SendJson(nlohmann::json{{"type", protocol::Join},
        {"payload", {{"roomId", roomId}, {"spectator", spectator}, {"hidden", false}}}});
    auto state = AwaitState(stopToken);
    roomId_.store(state.id);
    return state;
}

void RoomSessionGateway::Leave()
{
    if (client_.IsConnected() && roomId_.load() > 0)
    {
        try
        {
            SendJson(nlohmann::json{{"type", protocol::Leave}, {"payload", nlohmann::json::object()}});
        }
        catch (...)
        {
        }
    }
    Close();
}

void RoomSessionGateway::Interrupt()
{
    static_cast<void>(FailPendingCommands(
        std::string("Connexion " "\xC3\xA0" " la table interrompue.")));
    std::scoped_lock sendLock(sendMutex_);
    client_.Close();
}

void RoomSessionGateway::Close()
{
    Interrupt();
    roomId_.store(0);
    selfSpectator_.store(false);
    {
        std::scoped_lock lock(pendingEventsMutex_);
        pendingEvents_.clear();
    }
}
}
