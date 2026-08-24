#pragma once

#include <optional>
#include <string>

namespace lila::modules::presence::domain
{
struct PresencePlayer final
{
    int id = 0;
    std::string username;
    std::string activity = "home";
    std::optional<int> currentRoomId;
    std::string currentRoomName;
    std::string availability;
    std::string location;
};
}
