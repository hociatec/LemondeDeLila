#include <cassert>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace
{
using namespace std::chrono_literals;

class FakeTicketProvider final
    : public lila::shared::network::http::IWsTicketProvider
{
public:
    [[nodiscard]] std::string GetTicket(
        const std::string&,
        const std::string&) const override
    {
        return "ticket";
    }
};

class FakeWebSocketClient final
    : public lila::shared::network::websocket::IWebSocketClient
{
public:
    explicit FakeWebSocketClient(bool blockReceive) : blockReceive_(blockReceive) {}

    void Connect(
        const std::string& endpoint,
        const lila::shared::network::websocket::WebSocketHeaders& headers,
        std::stop_token) override
    {
        endpoint_ = endpoint;
        headers_ = headers;
        connected_ = true;
    }

    void Close() override { CancelPendingOperation(); }

    void CancelPendingOperation() noexcept override
    {
        {
            std::scoped_lock lock(mutex_);
            cancelled_.store(true);
            connected_.store(false);
        }
        condition_.notify_all();
    }

    [[nodiscard]] bool IsConnected() const override { return connected_.load(); }

    [[nodiscard]] bool IsConnectedTo(
        const std::string& endpoint,
        const lila::shared::network::websocket::WebSocketHeaders& headers) const override
    {
        return connected_.load() && endpoint_ == endpoint && headers_ == headers;
    }

    void Send(const std::string& payload) override { sentPayload_ = payload; }

    [[nodiscard]] std::string Receive() override
    {
        if (blockReceive_)
        {
            std::unique_lock lock(mutex_);
            condition_.wait(lock, [this]() { return cancelled_.load(); });
            throw std::runtime_error("receive cancelled");
        }

        const auto request = nlohmann::json::parse(sentPayload_);
        return nlohmann::json({
            {"type", request.at("type")},
            {"requestId", request.at("requestId")},
            {"payload", nlohmann::json::object()},
        }).dump();
    }

    [[nodiscard]] std::string SendAndReceive(
        const std::string&,
        const std::string&,
        const lila::shared::network::websocket::WebSocketHeaders&,
        std::stop_token) override
    {
        throw std::runtime_error("unexpected SendAndReceive call");
    }

    [[nodiscard]] bool WasCancelled() const { return cancelled_.load(); }

private:
    bool blockReceive_;
    std::atomic_bool connected_ = false;
    std::atomic_bool cancelled_ = false;
    std::string endpoint_;
    std::string sentPayload_;
    lila::shared::network::websocket::WebSocketHeaders headers_;
    mutable std::mutex mutex_;
    std::condition_variable condition_;
};

void TestHungRequestTimesOut()
{
    FakeWebSocketClient socket(true);
    FakeTicketProvider tickets;
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient client(
        "wss://example.test/ws/api", "1.2.58", socket, tickets, 25ms);

    const auto started = std::chrono::steady_clock::now();
    const auto response = client.Send({"catalog.all", nlohmann::json::object()}, "token");
    const auto elapsed = std::chrono::steady_clock::now() - started;

    assert(!response.success);
    assert(response.errorKind ==
        lila::shared::network::realtime::RealtimeErrorKind::Transport);
    assert(response.errorMessage == "WebSocket request timed out.");
    assert(socket.WasCancelled());
    assert(elapsed < 1s);
}

void TestCompletedRequestDisarmsDeadline()
{
    FakeWebSocketClient socket(false);
    FakeTicketProvider tickets;
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient client(
        "wss://example.test/ws/api", "1.2.58", socket, tickets, 250ms);

    const auto response = client.Send({"catalog.all", nlohmann::json::object()}, "token");

    assert(response.success);
    assert(!socket.WasCancelled());
}
}

int main()
{
    TestHungRequestTimesOut();
    TestCompletedRequestDisarmsDeadline();
    return 0;
}
