#include <iostream>
#include <string>

#include "modules/chat/infrastructure/ChatProtocol.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"
#include "shared/text/presentation/encoding/Encoding.h"

int main()
{
    lila::modules::chat::infrastructure::ChatProtocol chatProtocol;
    std::string line;

    while (std::getline(std::cin, line))
    {
        try
        {
            static_cast<void>(chatProtocol.ParseEvent(line, 1, 0));
        }
        catch (...)
        {
        }

        try
        {
            static_cast<void>(lila::shared::network::realtime::protocol::ParseResponse(
                line,
                "fuzz-request-id",
                "fuzz.type"));
        }
        catch (...)
        {
        }

        try
        {
            static_cast<void>(lila::shared::text::FromUtf8(line));
        }
        catch (...)
        {
        }
    }

    std::cout << "parser fuzz harness completed\n";
    return 0;
}
