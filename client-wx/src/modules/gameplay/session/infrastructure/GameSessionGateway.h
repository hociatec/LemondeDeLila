#pragma once

#include <atomic>
#include <mutex>
#include <string>
#include <string_view>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/session/application/IGameSessionGateway.h"

namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::network::http { class IWsTicketProvider; }
namespace lila::shared::network::websocket { class IWebSocketClient; }

namespace lila::modules::gameplay::infrastructure
{
class GameSessionGateway final : public application::IGameSessionGateway
{
public:
    GameSessionGateway(
        std::string endpoint,
        lila::shared::network::websocket::IWebSocketClient& client,
        lila::shared::network::http::IWsTicketProvider& ticketProvider,
        lila::modules::session::application::SessionStore& sessionStore);

    [[nodiscard]] domain::GameState Join(
        int roomId,
        std::string_view gameType,
        std::stop_token stopToken) override;
    void RequestState(std::stop_token stopToken) override;
    void RequestRules(std::stop_token stopToken) override;
    void SendKey(std::string_view key, std::stop_token stopToken) override;
    void ExecuteAction(
        const domain::GameCommandEnvelope& command,
        std::stop_token stopToken) override;
    void RequestActionCandidates(
        const domain::GameActionCandidatesRequest& request,
        std::stop_token stopToken) override;
    [[nodiscard]] domain::GameEvent ReceiveEvent(std::stop_token stopToken) override;
    void Interrupt() override;
    void Close() override;

private:
    void Connect(std::stop_token stopToken);
    void SendJson(const nlohmann::json& message);
    [[nodiscard]] domain::GameState AwaitState(std::stop_token stopToken);

    std::string endpoint_;
    lila::shared::network::websocket::IWebSocketClient& client_;
    lila::shared::network::http::IWsTicketProvider& ticketProvider_;
    lila::modules::session::application::SessionStore& sessionStore_;
    std::mutex sendMutex_;
    std::atomic<int> roomId_ = 0;
    std::string gameType_;
};
}
