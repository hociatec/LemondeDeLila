#pragma once

#include <vector>
#include <nlohmann/json_fwd.hpp>
#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::infrastructure::codec
{
[[nodiscard]] std::vector<domain::PublicRoom> ReadPublicRooms(const nlohmann::json& payload);
[[nodiscard]] domain::RoomState ReadRoomState(const nlohmann::json& payload);
}
