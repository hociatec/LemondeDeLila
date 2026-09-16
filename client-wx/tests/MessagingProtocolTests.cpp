#include <cassert>
#include <iostream>
#include <utility>
#include "modules/messaging/infrastructure/MessagingResponseType.h"
#include "modules/messaging/infrastructure/MessagingPayloadCodec.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"

int main()
{
    using namespace lila::shared::network::realtime;
    using namespace lila::modules::messaging::infrastructure;
    const std::pair<const char*, const char*> routes[] = {
        {"messaging.search", "messaging.user"},
        {"messaging.send", "messaging.message"},
        {"messaging.delete", "messaging.deleted"},
        {"messaging.restore", "messaging.restored"},
        {"messaging.purge", "messaging.purged"},
        {"messaging.messages", "messaging.messages"},
        {"messaging.markRead", "messaging.markRead"},
    };
    for (const auto& [request, response] : routes)
    {
        const auto raw = nlohmann::json({{"type", response}, {"requestId", "test"},
            {"payload", nlohmann::json::object()}}).dump();
        assert(MessagingResponseType(request) == response);
        assert(protocol::IsResponseForRequest(raw, "test", request, MessagingResponseType(request)));
        assert(protocol::ParseResponse(raw, "test", request, MessagingResponseType(request)).success);
        if (std::string(request) != response)
            assert(!protocol::IsResponseForRequest(raw, "test", request, {}));
    }
    const nlohmann::json message = {
        {"id", "test-message"}, {"sender", {{"id", 1}, {"username", "Alice"}}},
        {"recipient", {{"id", 2}, {"username", "Bob"}}},
        {"text", "Bonjour\nDeuxième ligne"}, {"subject", nullptr},
        {"createdAt", "2026-09-16T20:00:00.000Z"}, {"direction", "sent"},
        {"deletedAt", nullptr}, {"boxType", "outbox"}};
    RealtimeApiResponse response;
    response.payload = {{"message", message}};
    const auto sent = codec::ReadMessagePayload(response);
    assert(sent && sent->isSent && sent->subject.empty());
    response.payload = {{"items", nlohmann::json::array({message})}};
    const auto box = codec::ReadMessagesPayload(response);
    assert(box.size() == 1 && box.front().text == "Bonjour\nDeuxième ligne");
    response.payload = {{"items", nlohmann::json::array()}};
    assert(codec::ReadMessagesPayload(response).empty());
    response.payload = {{"user", {{"id", 2}, {"username", "Bob"}}}};
    assert(codec::ReadSearchUserPayload(response)->username == "Bob");
    std::cout << "Messaging protocol and decoding tests passed.\n";
}
