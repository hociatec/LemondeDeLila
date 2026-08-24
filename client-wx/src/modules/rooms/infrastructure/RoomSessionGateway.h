#pragma once
#include <atomic>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <string>
#include <unordered_map>

#include <nlohmann/json_fwd.hpp>

#include "modules/rooms/application/IRoomSessionGateway.h"
namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::network::http { class IWsTicketProvider; }
namespace lila::shared::network::websocket { class IWebSocketClient; }
namespace lila::modules::rooms::infrastructure
{
class RoomSessionGateway final : public application::IRoomSessionGateway
{
public:
    RoomSessionGateway(std::string endpoint,
        lila::shared::network::websocket::IWebSocketClient& client,
        lila::shared::network::http::IWsTicketProvider& ticketProvider,
        lila::modules::session::application::SessionStore& sessionStore);
    [[nodiscard]] domain::RoomState Create(std::string_view gameType, std::stop_token stopToken) override;
    [[nodiscard]] domain::RoomState Join(int roomId, bool spectator, std::stop_token stopToken) override;
    [[nodiscard]] domain::RoomState Reconnect(std::stop_token stopToken) override;
    void Execute(const domain::RoomCommandRequest& request, std::stop_token stopToken) override;
    [[nodiscard]] domain::RoomEvent ReceiveEvent(std::stop_token stopToken) override;
    void Interrupt() override;
    void Leave() override;
    void Close() override;
private:
    void Connect();
    void SendJson(const nlohmann::json& message);
    [[nodiscard]] domain::RoomState AwaitState(std::stop_token stopToken);
    [[nodiscard]] domain::RoomEvent DecodeEvent(const nlohmann::json& message);
    [[nodiscard]] std::string CreateTraceId();
    void CompleteAcknowledgement(std::string_view traceId);
    [[nodiscard]] bool FailPendingCommands(std::string_view message);

    struct PendingCommand final
    {
        bool completed = false;
        std::string error;
    };
    std::string endpoint_;
    lila::shared::network::websocket::IWebSocketClient& client_;
    lila::shared::network::http::IWsTicketProvider& ticketProvider_;
    lila::modules::session::application::SessionStore& sessionStore_;
    std::deque<domain::RoomEvent> pendingEvents_;
    std::mutex pendingEventsMutex_;
    std::unordered_map<std::string, PendingCommand> pendingCommands_;
    std::mutex pendingCommandsMutex_;
    std::condition_variable pendingCommandsCondition_;
    std::mutex sendMutex_;
    std::atomic<unsigned long long> traceCounter_ = 0;
    std::atomic<int> roomId_ = 0;
    std::atomic<bool> selfSpectator_ = false;
};
}
