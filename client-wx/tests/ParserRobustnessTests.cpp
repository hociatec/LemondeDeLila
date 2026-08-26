#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>

#include "modules/chat/infrastructure/ChatProtocol.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace
{
void ProbeInput(const std::string& input)
{
    lila::modules::chat::infrastructure::ChatProtocol chatProtocol;
    try
    {
        static_cast<void>(chatProtocol.ParseEvent(input, 1, 0));
    }
    catch (...)
    {
    }

    try
    {
        static_cast<void>(lila::shared::network::realtime::protocol::ParseResponse(
            input,
            "robustness-request-id",
            "robustness.type"));
    }
    catch (...)
    {
    }

    try
    {
        static_cast<void>(lila::shared::text::FromUtf8(input));
    }
    catch (...)
    {
    }
}

std::size_t ProbeFile(const char* path)
{
    std::ifstream input(path, std::ios::binary);
    if (!input.is_open()) throw std::runtime_error(std::string("Corpus inaccessible: ") + path);

    std::size_t count = 0;
    std::string line;
    while (std::getline(input, line))
    {
        ProbeInput(line);
        ++count;
    }
    return count;
}
}

int main(int argc, char** argv)
{
    if (argc < 2) throw std::runtime_error("Un corpus de robustesse est requis.");

    std::size_t inputCount = 0;
    for (int index = 1; index < argc; ++index) inputCount += ProbeFile(argv[index]);
    if (inputCount == 0) throw std::runtime_error("Le corpus de robustesse est vide.");

    std::cout << "Parser robustness tests passed for " << inputCount << " inputs.\n";
    return 0;
}
