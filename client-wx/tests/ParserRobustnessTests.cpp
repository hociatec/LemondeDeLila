#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/catalog/infrastructure/CatalogPayloadCodec.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"
#include "modules/messaging/infrastructure/MessagingPayloadCodec.h"
#include "modules/presence/infrastructure/PresencePayloadCodec.h"
#include "modules/rooms/infrastructure/RoomPayloadCodec.h"
#include "modules/social/infrastructure/SocialPayloadCodec.h"
#include "modules/storybook/infrastructure/StoryBookPayloadCodec.h"
#include "modules/vault/infrastructure/VaultPayloadCodec.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"

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

    const auto document = nlohmann::json::parse(input, nullptr, false);
    const auto payload = document.is_discarded()
        ? nlohmann::json::object() : document;
    const auto probe = [](auto&& operation)
    {
        try { operation(); }
        catch (...) { /* Rejection is valid; crashes and hangs are not. */ }
    };

    probe([&] { static_cast<void>(lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(payload)); });
    probe([&] { static_cast<void>(lila::modules::rooms::infrastructure::codec::
        ReadPublicRooms(payload)); });
    probe([&] { static_cast<void>(lila::modules::rooms::infrastructure::codec::
        ReadRoomState(payload)); });

    lila::shared::network::realtime::RealtimeApiResponse response;
    response.payload = payload;
    probe([&] { static_cast<void>(lila::modules::messaging::infrastructure::codec::
        ReadMessagesPayload(response)); });
    probe([&] { static_cast<void>(lila::modules::social::infrastructure::codec::
        ReadUsersPayload("social.users", payload)); });
    probe([&] { static_cast<void>(lila::modules::presence::infrastructure::
        ReadPresenceUpdate(input)); });
    probe([&] { static_cast<void>(lila::modules::catalog::infrastructure::codec::
        ReadCatalogPayload(payload)); });
    probe([&] { static_cast<void>(lila::modules::vault::infrastructure::codec::
        ReadSnapshots(payload)); });
    probe([&] { static_cast<void>(lila::modules::storybook::infrastructure::codec::
        ReadStoryBookPayload(payload)); });
}

std::vector<std::string> GeneratedBoundaryInputs()
{
    std::vector<std::string> result;
    std::string nested = "0";
    for (int depth = 0; depth < 48; ++depth) nested = "{\"next\":" + nested + "}";
    result.push_back(std::move(nested));
    result.push_back(nlohmann::json(std::string(20U * 1024U, 'x')).dump());
    result.push_back(nlohmann::json(std::vector<int>(1'100, 1)).dump());
    result.emplace_back("{\"text\":\"\xC3\x28\"}", 13);
    return result;
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
    for (const auto& input : GeneratedBoundaryInputs())
    {
        ProbeInput(input);
        ++inputCount;
    }
    if (inputCount == 0) throw std::runtime_error("Le corpus de robustesse est vide.");

    std::cout << "Parser robustness tests passed for " << inputCount << " inputs.\n";
    return 0;
}
