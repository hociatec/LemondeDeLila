#include <cassert>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"
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
        return "ticket-" + std::to_string(++calls);
    }
    mutable int calls = 0;
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
        ++connections;
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

    void Send(const std::string& payload) override { ++sends; sentPayload_ = payload; }

    [[nodiscard]] std::string Receive() override
    {
        if (failNextReceive)
        {
            failNextReceive = false;
            throw std::runtime_error("connection dropped after send");
        }
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
    int connections = 0;
    int sends = 0;
    bool failNextReceive = false;

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

class SequencedWebSocketClient final
    : public lila::shared::network::websocket::IWebSocketClient
{
public:
    using WebSocketHeaders = lila::shared::network::websocket::WebSocketHeaders;
    void Connect(const std::string&, const WebSocketHeaders&, std::stop_token) override
    {
        connected_ = true;
    }
    void Close() override { connected_ = false; }
    void CancelPendingOperation() noexcept override { connected_ = false; }
    [[nodiscard]] bool IsConnected() const override { return connected_; }
    [[nodiscard]] bool IsConnectedTo(const std::string&, const WebSocketHeaders&) const override
    {
        return connected_;
    }
    void Send(const std::string& payload) override
    {
        const auto request = nlohmann::json::parse(payload);
        const auto requestId = request.at("requestId").get<std::string>();
        if (sendCount_++ == 0)
        {
            responses_.push_back(R"({"type":"notify.unknown","payload":{}})");
            responses_.push_back(nlohmann::json({
                {"type", request.at("type")}, {"requestId", "late-request"},
                {"payload", nlohmann::json::object()}}).dump());
        }
        const auto correlated = nlohmann::json({
            {"type", request.at("type")}, {"requestId", requestId},
            {"payload", {{"sequence", sendCount_}}}}).dump();
        responses_.push_back(correlated);
        if (sendCount_ == 1) responses_.push_back(correlated);
    }
    [[nodiscard]] std::string Receive() override
    {
        assert(!responses_.empty());
        auto response = std::move(responses_.front());
        responses_.pop_front();
        ++receiveCount;
        return response;
    }
    [[nodiscard]] std::string SendAndReceive(
        const std::string&, const std::string&, const WebSocketHeaders&, std::stop_token) override
    {
        throw std::runtime_error("unexpected SendAndReceive call");
    }

    int receiveCount = 0;
private:
    bool connected_ = false;
    int sendCount_ = 0;
    std::deque<std::string> responses_;
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

void TestConnectionReuseAndCredentialChanges()
{
    FakeWebSocketClient socket(false);
    FakeTicketProvider tickets;
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient client(
        "wss://example.test/ws/api", "1.2.58", socket, tickets, 250ms);
    const lila::shared::network::realtime::RealtimeApiRequest request{
        "catalog.all", nlohmann::json::object()};
    assert(client.Send(request, "token").success);
    assert(client.Send(request, "token").success);
    assert(tickets.calls == 1 && socket.connections == 1);
    assert(client.Send(request, "refreshed-token").success);
    assert(tickets.calls == 2 && socket.connections == 2);
    socket.Close();
    assert(client.Send(request, "refreshed-token").success);
    assert(tickets.calls == 3 && socket.connections == 3);
    std::stop_source cancelled;
    cancelled.request_stop();
    const auto response = client.Send(request, "another-token", cancelled.get_token());
    assert(response.errorKind == lila::shared::network::realtime::RealtimeErrorKind::Cancelled);
    assert(tickets.calls == 3 && socket.connections == 3);
    assert(client.Send(request, "").success);
    assert(tickets.calls == 3 && socket.connections == 4);
    assert(client.Send(request, "").success);
    assert(socket.connections == 4);

    // A failed receive may follow an already committed command: do not replay
    // it automatically. Only the next caller establishes a fresh connection.
    socket.failNextReceive = true;
    const auto sendsBeforeFailure = socket.sends;
    assert(!client.Send(request, "").success);
    assert(socket.sends == sendsBeforeFailure + 1);
    assert(client.Send(request, "").success);
    assert(socket.connections == 5);
}

void TestCorrelatedTypedErrorIsReturnedAsServerError()
{
    constexpr auto RequestId = "contact-request-1";
    const auto rawResponse = nlohmann::json({
        {"type", "notify.admin_contact.error"},
        {"requestId", RequestId},
        {"payload", {{"message", "Conversation introuvable."}}},
    }).dump();

    assert(lila::shared::network::realtime::protocol::IsResponseForRequest(
        rawResponse, RequestId, "notify.admin_contact.list"));

    const auto response = lila::shared::network::realtime::protocol::ParseResponse(
        rawResponse, RequestId, "notify.admin_contact.list");
    assert(!response.success);
    assert(response.errorKind ==
        lila::shared::network::realtime::RealtimeErrorKind::Server);
    assert(response.errorMessage == "Conversation introuvable.");
}

void TestUnrelatedLateAndDuplicateResponsesAreIgnored()
{
    SequencedWebSocketClient socket;
    FakeTicketProvider tickets;
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient client(
        "wss://example.test/ws/api", "1.2.58", socket, tickets, 250ms);

    const auto first = client.Send({"catalog.all", nlohmann::json::object()}, "token");
    const auto second = client.Send({"catalog.all", nlohmann::json::object()}, "token");

    assert(first.success && first.payload.at("sequence") == 1);
    assert(second.success && second.payload.at("sequence") == 2);
    assert(socket.receiveCount == 5);
}
}

int main()
{
    TestHungRequestTimesOut();
    TestCompletedRequestDisarmsDeadline();
    TestConnectionReuseAndCredentialChanges();
    TestCorrelatedTypedErrorIsReturnedAsServerError();
    TestUnrelatedLateAndDuplicateResponsesAreIgnored();
    return 0;
}
