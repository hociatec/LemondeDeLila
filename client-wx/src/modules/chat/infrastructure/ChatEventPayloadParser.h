#pragma once

#include <ctime>
#include <string>

#include <nlohmann/json_fwd.hpp>

#include "modules/chat/infrastructure/ChatProtocol.h"

namespace lila::modules::chat::infrastructure::codec::detail
{
bool IsChatEventType(const std::string& type);
ChatEvent BuildErrorEvent(const std::string& message);
ChatEvent ParseHistoryEvent(const nlohmann::json& root, int currentUserId, std::time_t nowUtc);
ChatEvent ParseMessageUpsertEvent(const nlohmann::json& root, int currentUserId, std::time_t nowUtc);
ChatEvent ParseMessageDeletedEvent(const nlohmann::json& root);
ChatEvent ParseErrorEvent(const nlohmann::json& root);
}

