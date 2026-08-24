#include "modules/gameplay/infrastructure/GameSessionGateway.h"

#include <stdexcept>
#include <utility>

#include <nlohmann/json.hpp>

#include "modules/gameplay/infrastructure/GameStatePayloadCodec.h"
#include "modules/session/application/SessionStore.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/WebSocketConstants.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::string ReadString(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    return found != value.end() && found->is_string() ? found->get<std::string>() : std::string{};
}
}

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
        const auto ticket = ticketProvider_.GetTicket(
            std::string(lila::shared::network::ws::WsTicketScopeGame),
            token);
        lila::shared::network::websocket::WebSocketHeaders headers{
            {std::string(lila::shared::network::ws::ClientProductHeader),
             std::string(lila::shared::network::ws::ClientProduct)},
            {std::string(lila::shared::network::ws::AuthorizationHeader),
             std::string(lila::shared::network::ws::AuthorizationScheme) + token},
            {std::string(lila::shared::network::ws::WsTicketHeader), ticket},
            {std::string(lila::shared::network::ws::ClientVersionHeader),
             lila::shared::config::AppConfig::ResolveClientVersion()}};
        client_.Connect(endpoint_, headers, stopToken);
    };
    try
    {
        connect(sessionStore_.AccessToken());
    }
    catch (const lila::shared::network::http::WsTicketRequestError& exception)
    {
        if (exception.StatusCode() != 401 && exception.StatusCode() != 403)
        {
            throw;
        }
        client_.Close();
        connect(sessionStore_.RefreshAccessToken());
    }
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

void GameSessionGateway::ExecuteAction(const domain::GameAction& action, std::stop_token)
{
    const auto roomId = roomId_.load();
    if (roomId <= 0 || gameType_.empty()) throw std::runtime_error("Aucune partie active.");
    if (action.type.empty()) throw std::invalid_argument("Action de jeu invalide.");
    SendJson(nlohmann::json{
        {"type", "game.actions"},
        {"payload", GameStatePayloadCodec::EncodeActionPayload(roomId, gameType_, action)}});
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
            throw std::runtime_error(event.message.empty() ? "Etat de jeu indisponible." : event.message);
        }
    }
    throw std::runtime_error("Connexion au jeu interrompue.");
}

domain::GameEvent GameSessionGateway::ReceiveEvent(std::stop_token)
{
    const auto raw = client_.Receive();
    const auto message = nlohmann::json::parse(raw);
    return DecodeEvent(message);
}

domain::GameEvent GameSessionGateway::DecodeEvent(const nlohmann::json& message)
{
    if (!message.is_object()) return {domain::GameEventType::Ignored};
    const auto type = ReadString(message, "type");
    const auto payload = message.value("payload", nlohmann::json::object());
    if (type == "game.state")
    {
        return {domain::GameEventType::StateUpdated, GameStatePayloadCodec::DecodeState(payload)};
    }
    if (type == "game.ack")
    {
        return {domain::GameEventType::Acknowledged, std::nullopt, ReadString(payload, "action"), false};
    }
    if (type == "game.turn")
    {
        return {domain::GameEventType::ConnectionStatus, std::nullopt, ReadString(payload, "currentPlayerUsername"), false};
    }
    if (type == "error")
    {
        auto messageText = ReadString(payload, "message");
        if (messageText.empty()) messageText = ReadString(payload, "error");
        return {domain::GameEventType::Error, std::nullopt,
            messageText.empty() ? std::string("Action de jeu impossible.") : messageText, true};
    }
    return {domain::GameEventType::Ignored};
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
