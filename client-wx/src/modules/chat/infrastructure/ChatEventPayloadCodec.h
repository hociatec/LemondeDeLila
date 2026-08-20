#pragma once

#include "modules/chat/infrastructure/ChatProtocol.h"

#include <ctime>
#include <string>

namespace lila::modules::chat::infrastructure::codec
{
[[nodiscard]] std::string BuildSendPayload(const std::string& text);
[[nodiscard]] std::string BuildEditPayload(const std::string& messageId, const std::string& text);
[[nodiscard]] std::string BuildDeletePayload(const std::string& messageId);
[[nodiscard]] ChatEvent ParseEvent(const std::string& rawJson, int currentUserId, std::time_t nowUtc);
}
