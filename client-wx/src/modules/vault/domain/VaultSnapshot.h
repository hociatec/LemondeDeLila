#pragma once

#include <string>

namespace lila::modules::vault::domain
{
struct VaultSnapshot
{
    std::string id;
    std::string name;
    std::string roomName;
    std::string gameType;
    std::string playersLabel;
    std::string createdAt;
};
}
