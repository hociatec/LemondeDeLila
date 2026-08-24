#include <cassert>
#include <stdexcept>

#include "shared/network/domain/UrlUtils.h"

int main()
{
    using lila::shared::network::ExtractOrigin;
    using lila::shared::network::WebSocketOriginToHttp;

    assert(ExtractOrigin("wss://example.test/api/ws") == "wss://example.test");
    assert(ExtractOrigin("http://localhost:8080") == "http://localhost:8080");
    assert(WebSocketOriginToHttp("wss://example.test/ws") == "https://example.test");
    assert(WebSocketOriginToHttp("ws://localhost:8080/ws") == "http://localhost:8080");

    bool rejected = false;
    try
    {
        static_cast<void>(WebSocketOriginToHttp("https://example.test/ws"));
    }
    catch (const std::runtime_error&)
    {
        rejected = true;
    }
    assert(rejected);
}
