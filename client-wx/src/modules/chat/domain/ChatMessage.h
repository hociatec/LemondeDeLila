#pragma once

#include <ctime>
#include <string>

namespace lila::modules::chat::domain
{
struct ChatMessage final
{
    std::string id;
    int userId = 0;
    std::string user;
    std::string text;
    std::time_t timestampUtc = 0;
    bool isDeleted = false;
    bool isMine = false;
};
}
