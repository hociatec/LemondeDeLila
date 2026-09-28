#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/presence/domain/PresencePlayer.h"

namespace lila::modules::presence::application
{
[[nodiscard]] std::optional<std::vector<domain::PresencePlayer>> ParsePresenceUpdate(
    const std::string& rawJson);
}
