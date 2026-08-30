#pragma once

#include <string_view>
#include <vector>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::infrastructure
{
[[nodiscard]] std::vector<domain::TableAmbience> ReadTableAmbiencesResponse(
    std::string_view rawJson);
}
