#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "modules/presence/domain/PresencePlayer.h"

namespace lila::modules::presence::infrastructure
{
[[nodiscard]] std::optional<std::vector<domain::PresencePlayer>> ReadPresenceUpdate(const std::string& rawJson);
[[nodiscard]] std::string WritePresenceContext(std::string_view context);
[[nodiscard]] std::string PresenceActivityMessage();
}
