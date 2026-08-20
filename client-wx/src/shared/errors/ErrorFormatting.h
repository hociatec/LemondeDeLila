#pragma once

#include <string>

namespace lila::shared::errors
{
inline std::string WithDetails(const char* message, const std::string& details)
{
    if (details.empty()) return std::string(message);
    const std::string baseMessage(message);
    if (baseMessage.empty()) return details;
    if (baseMessage.back() == ':') return baseMessage + " " + details;
    if (baseMessage.back() == ' ') return baseMessage + details;
    return baseMessage + " : " + details;
}
}
