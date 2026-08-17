#include <cassert>
#include <stdexcept>

#include "shared/data/JsonReaders.h"
#include "shared/network/realtime/RealtimeProtocol.h"

namespace
{
void TestJsonReaders()
{
    const auto document = lila::shared::data::json::ParseDocument(R"({"id":7,"enabled":true,"name":"Lila"})", "test");
    assert(lila::shared::data::json::ReadOptionalInteger(document, "id") == 7);
    assert(lila::shared::data::json::ReadOptionalBool(document, "enabled", false));
    assert(lila::shared::data::json::ReadOptionalString(document, "name") == "Lila");

    bool rejectedInvalidJson = false;
    try
    {
        (void)lila::shared::data::json::ParseDocument("{", "test");
    }
    catch (const std::runtime_error&)
    {
        rejectedInvalidJson = true;
    }
    assert(rejectedInvalidJson);
}

void TestRealtimeProtocol()
{
    lila::shared::network::realtime::RealtimeApiRequest request{
        .type = "auth.login",
        .payload = {{"username", "lila"}},
    };
    const std::string envelope = lila::shared::network::realtime::protocol::BuildEnvelope(request, "request-1");
    assert(envelope.find("request-1") != std::string::npos);

    const auto success = lila::shared::network::realtime::protocol::ParseResponse(
        R"({"type":"auth.login","requestId":"request-1","success":true,"payload":{"id":7}})",
        "request-1",
        "auth.login");
    assert(success.success);
    assert(success.payload.at("id") == 7);

    const auto failure = lila::shared::network::realtime::protocol::ParseResponse(
        R"({"type":"error","requestId":"request-1","payload":{"message":"Refusé"}})",
        "request-1",
        "auth.login");
    assert(!failure.success);
    assert(failure.errorKind == lila::shared::network::realtime::RealtimeErrorKind::Server);

    bool rejectedMismatch = false;
    try
    {
        (void)lila::shared::network::realtime::protocol::ParseResponse(
            R"({"type":"auth.login","requestId":"other","success":true})",
            "request-1",
            "auth.login");
    }
    catch (const lila::shared::network::realtime::protocol::RealtimeProtocolError&)
    {
        rejectedMismatch = true;
    }
    assert(rejectedMismatch);
}
}

int main()
{
    TestJsonReaders();
    TestRealtimeProtocol();
    return 0;
}
