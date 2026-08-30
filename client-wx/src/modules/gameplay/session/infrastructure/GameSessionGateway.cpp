#include "modules/gameplay/session/infrastructure/GameSessionGateway.h"

#include <stdexcept>
#include <utility>

#include <nlohmann/json.hpp>

#include "modules/gameplay/session/infrastructure/GameEventPayloadCodec.h"
#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"
#include "modules/session/application/SessionConnectionRetry.h"
#include "modules/session/application/SessionStore.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/AuthenticatedWebSocketHeaders.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/logging/application/Logger.h"
#include "shared/errors/domain/AppError.h"

namespace lila::modules::gameplay::infrastructure
{
GameSessionGateway::GameSessionGateway(
    std::string endpoint,
    lila::shared::network::websocket::IWebSocketClient& client,
    lila::shared::network::http::IWsTicketProvider& ticketProvider,
    lila::modules::session::application::SessionStore& sessionStore)
    : endpoint_(std::move(endpoint)),
      client_(client),
      ticketProvider_(ticketProvider),
      sessionStore_(sessionStore)
{
}

void GameSessionGateway::Connect(std::stop_token stopToken)
{
    if (!sessionStore_.HasActiveSession()) throw std::runtime_error("Aucune session active pour le jeu.");
    std::scoped_lock sendLock(sendMutex_);
    client_.Close();
    const auto connect = [this, stopToken](const std::string& token)
    {
        client_.Connect(
            endpoint_,
            lila::shared::network::websocket::BuildAuthenticatedHeaders(
                ticketProvider_, lila::shared::network::ws::WsTicketScopeGame, token),
            stopToken);
    };
    lila::modules::session::application::ConnectWithSessionRefresh(
        sessionStore_, stopToken, [this] { client_.Close(); }, connect);
}

void GameSessionGateway::SendJson(const nlohmann::json& message)
{
    std::scoped_lock sendLock(sendMutex_);
    if (!client_.IsConnected()) throw std::runtime_error("Aucune session de jeu active.");
    client_.Send(message.dump());
}

domain::GameState GameSessionGateway::Join(
    int roomId,
    std::string_view gameType,
    std::stop_token stopToken)
{
    if (roomId <= 0) throw std::invalid_argument("roomId jeu invalide.");
    if (gameType.empty()) throw std::invalid_argument("gameType jeu requis.");
    roomId_.store(roomId);
    gameType_ = std::string(gameType);
    Connect(stopToken);
    SendJson(nlohmann::json{
        {"type", "game.join"},
        {"payload", {{"roomId", roomId}, {"gameType", gameType_}}}});
    return AwaitState(stopToken);
}

void GameSessionGateway::RequestState(std::stop_token)
{
    const auto roomId = roomId_.load();
    if (roomId <= 0 || gameType_.empty()) throw std::runtime_error("Aucune partie active.");
    SendJson(nlohmann::json{
        {"type", "game.state"},
        {"payload", {{"roomId", roomId}, {"gameType", gameType_}}}});
}

void GameSessionGateway::RequestRules(std::stop_token)
{
    if (gameType_.empty()) throw std::runtime_error("Aucune partie active.");
    SendJson(nlohmann::json{{"type", "game.rules"},
        {"payload", {{"gameType", gameType_}}}});
}

void GameSessionGateway::SendKey(std::string_view key, std::stop_token)
{
    const auto roomId = roomId_.load();
    if (roomId <= 0 || gameType_.empty()) throw std::runtime_error("Aucune partie active.");
    const auto normalized = GameStatePayloadCodec::NormalizeShortcutKey(std::string(key));
    if (normalized.empty()) throw std::invalid_argument("Touche de jeu invalide.");
    SendJson(nlohmann::json{
        {"type", "game.key"},
        {"payload", {{"roomId", roomId}, {"gameType", gameType_}, {"key", normalized}}}});
}

void GameSessionGateway::ExecuteAction(const domain::GameAction& action, std::stop_token)
{
    const auto roomId = roomId_.load();
    if (roomId <= 0 || gameType_.empty()) throw std::runtime_error("Aucune partie active.");
    if (action.type.empty()) throw std::invalid_argument("Action de jeu invalide.");
    lila::shared::logging::LogInfo("GameInput", "Sending action: type=" + action.type);
    SendJson(nlohmann::json{
        {"type", "game.action"},
        {"payload", GameStatePayloadCodec::EncodeActionPayload(roomId, gameType_, action)}});
    lila::shared::logging::LogInfo("GameInput", "Action sent: type=" + action.type);
}

domain::GameState GameSessionGateway::AwaitState(std::stop_token stopToken)
{
    while (!stopToken.stop_requested())
    {
        auto event = ReceiveEvent(stopToken);
        if (event.type == domain::GameEventType::StateUpdated && event.state)
        {
            return std::move(*event.state);
        }
        if (event.type == domain::GameEventType::Error)
        {
            throw lila::shared::errors::AppException(
                lila::shared::errors::ToAppError(
                    event.message.empty()
                        ? "Etat de jeu indisponible."
                        : event.message));
        }
    }
    throw std::runtime_error("Connexion au jeu interrompue.");
}

domain::GameEvent GameSessionGateway::ReceiveEvent(std::stop_token)
{
    const auto raw = client_.Receive();
    const auto message = nlohmann::json::parse(raw);
    return GameEventPayloadCodec::Decode(message);
}

void GameSessionGateway::Interrupt()
{
    std::scoped_lock sendLock(sendMutex_);
    client_.CancelPendingOperation();
    client_.Close();
}

void GameSessionGateway::Close()
{
    Interrupt();
    roomId_.store(0);
    gameType_.clear();
}
}
