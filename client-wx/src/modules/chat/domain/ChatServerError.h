#pragma once

#include <optional>
#include <string>
#include <ctime>

namespace lila::modules::chat::domain
{
struct ChatServerError final
{
    std::string message;
    std::string reason;
    std::optional<std::time_t> untilUtc;
};
}
