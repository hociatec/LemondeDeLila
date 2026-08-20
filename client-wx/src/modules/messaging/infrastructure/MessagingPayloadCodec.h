#pragma once

#include <nlohmann/json.hpp>

#include <optional>
#include <string>
#include <vector>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"
#include "shared/network/realtime/RealtimeApiClient.h"

namespace lila::modules::messaging::infrastructure::codec
{
[[nodiscard]] std::string BoxToString(domain::MessagingBox box);
[[nodiscard]] std::vector<domain::MessagingMessage> ReadMessagesPayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response);
[[nodiscard]] std::optional<domain::MessagingMessage> ReadMessagePayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response);
[[nodiscard]] std::optional<domain::MessagingUser> ReadSearchUserPayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response);
}
