#include <cassert>
#include <iostream>
#include <stdexcept>

#include "shared/network/domain/WebSocketConstants.h"
#include "shared/text/infrastructure/Utf8ToWide.h"

int main()
{
    using namespace lila::shared::network::ws;
    assert(IsWebSocketPayloadSizeAllowed(0));
    assert(IsWebSocketPayloadSizeAllowed(MaximumWebSocketMessageBytes));
    assert(!IsWebSocketPayloadSizeAllowed(MaximumWebSocketMessageBytes + 1));

    std::size_t accumulated = 0;
    for (const auto fragment : {4096U, 8192U, 16U})
    {
        assert(CanAppendWebSocketFragment(accumulated, fragment));
        accumulated += fragment;
    }
    assert(CanAppendWebSocketFragment(MaximumWebSocketMessageBytes - 1, 1));
    assert(!CanAppendWebSocketFragment(MaximumWebSocketMessageBytes, 1));
    assert(!CanAppendWebSocketFragment(MaximumWebSocketMessageBytes + 1, 0));

    std::string message;
    assert(AppendWebSocketFragment(message, "message "));
    assert(AppendWebSocketFragment(message, "WebSocket "));
    assert(AppendWebSocketFragment(message, "fragmente"));
    assert(message == "message WebSocket fragmente");
    std::string full(MaximumWebSocketMessageBytes, 'x');
    assert(!AppendWebSocketFragment(full, "overflow"));

    const auto unicode = lila::shared::text::Utf8ToWide("Lila é 🎲");
    assert(!unicode.empty() && unicode.front() == L'L');
    bool rejectedInvalidUtf8 = false;
    try { static_cast<void>(lila::shared::text::Utf8ToWide("\xC0\xAF")); }
    catch (const std::runtime_error&) { rejectedInvalidUtf8 = true; }
    assert(rejectedInvalidUtf8);

    std::cout << "WebSocket policy tests passed.\n";
}
