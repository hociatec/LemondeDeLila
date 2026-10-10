#pragma once

#include <optional>
#include <string_view>
#include <nlohmann/json_fwd.hpp>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::infrastructure
{
[[nodiscard]] domain::RoomInvitationResponse ReadRoomInvitationResponse(
    std::string_view type, const nlohmann::json& payload, bool accept);
[[nodiscard]] std::optional<domain::RoomInvitation> ReadRoomInvitationMessage(
    std::string_view rawJson);
}
