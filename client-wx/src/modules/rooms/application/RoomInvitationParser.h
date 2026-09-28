#pragma once

#include <optional>
#include <string_view>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::application
{
[[nodiscard]] std::optional<domain::RoomInvitation> ParseRoomInvitation(std::string_view rawJson);
}
