#pragma once

#include <optional>
#include <string_view>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::infrastructure
{
[[nodiscard]] std::optional<domain::RoomInvitation> ReadRoomInvitationMessage(
    std::string_view rawJson);
}
