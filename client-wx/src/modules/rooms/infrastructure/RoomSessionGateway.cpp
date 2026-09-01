#include "modules/rooms/infrastructure/RoomSessionGateway.h"

#include <stdexcept>
#include <utility>
#include <nlohmann/json.hpp>
#include "modules/rooms/infrastructure/RoomProtocol.h"
#include "modules/session/application/SessionConnectionRetry.h"
#include "modules/session/application/SessionStore.h"
#include "shared/network/application/websocket/AuthenticatedWebSocketHeaders.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/logging/application/Logger.h"

namespace lila::modules::rooms::infrastructure
{
RoomSessionGateway::RoomSessionGateway(
    std::string endpoint,
    lila::shared::network::websocket::IWebSocketClient& client,
    lila::shared::network::http::IWsTicketProvider& ticketProvider,
    lila::modules::session::application::SessionStore& sessionStore)
    : endpoint_(std::move(endpoint)), client_(client), ticketProvider_(ticketProvider), sessionStore_(sessionStore) {}

void RoomSessionGateway::Connect(std::stop_token stopToken)
{
    if (!sessionStore_.HasActiveSession()) throw std::runtime_error("Aucune session active pour la table.");
    std::scoped_lock sendLock(sendMutex_);
    const auto connect = [this, stopToken](const std::string& token)
    {
        client_.Connect(
            endpoint_,
            lila::shared::network::websocket::BuildAuthenticatedHeaders(
                ticketProvider_, lila::shared::network::ws::WsTicketScopeRoom, token),
            stopToken);
    };
    lila::modules::session::application::ConnectWithSessionRefresh(
        sessionStore_, stopToken, [this] { client_.Close(); }, connect);
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
    Connect(stopToken);
    SendJson(nlohmann::json{
        {"type", protocol::IntentExecute},
        {"payload", {
            {"intentId", protocol::Create},
            {"data", {{"gameType", std::string(gameType)}}}}}});
    lila::shared::logging::LogInfo(
        "Rooms", "TX room.create gameType=" + std::string(gameType));
    selfSpectator_.store(false);
    auto state = AwaitState(std::nullopt, protocol::Created, stopToken);
    roomId_.store(state.id);
    return state;
}

domain::RoomState RoomSessionGateway::Join(int roomId, bool spectator, std::stop_token stopToken)
{
    if (roomId <= 0) throw std::invalid_argument("roomId invalide");
    Connect(stopToken);
    SendJson(nlohmann::json{{"type", protocol::IntentExecute},
        {"payload", {{"intentId", protocol::Join},
            {"data", {{"roomId", roomId}, {"spectator", spectator}, {"hidden", false}}}}}});
    lila::shared::logging::LogInfo(
        "Rooms", "TX room.join roomId=" + std::to_string(roomId));
    selfSpectator_.store(spectator);
    auto state = AwaitState(roomId, {}, stopToken);
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
    Connect(stopToken);
    SendJson(nlohmann::json{{"type", protocol::IntentExecute},
        {"payload", {{"intentId", protocol::Join},
            {"data", {{"roomId", roomId}, {"spectator", spectator}, {"hidden", false}}}}}});
    lila::shared::logging::LogInfo(
        "Rooms", "TX room.join roomId=" + std::to_string(roomId) + " reconnect=true");
    auto state = AwaitState(roomId, {}, stopToken);
    roomId_.store(state.id);
    return state;
}

void RoomSessionGateway::Leave()
{
    if (client_.IsConnected() && roomId_.load() > 0)
    {
        try
        {
            SendJson(nlohmann::json{{"type", protocol::IntentExecute},
                {"payload", {{"intentId", protocol::Leave}, {"data", nlohmann::json::object()}}}});
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
