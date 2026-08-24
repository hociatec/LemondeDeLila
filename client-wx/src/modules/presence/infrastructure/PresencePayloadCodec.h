#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/presence/domain/PresencePlayer.h"

namespace lila::modules::presence::infrastructure
{
[[nodiscard]] std::optional<std::vector<domain::PresencePlayer>> ReadPresenceUpdate(const std::string& rawJson);
}
