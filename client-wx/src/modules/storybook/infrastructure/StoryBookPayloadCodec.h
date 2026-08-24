#pragma once

#include <vector>

#include <nlohmann/json_fwd.hpp>

#include "modules/storybook/domain/StoryBookStats.h"

namespace lila::modules::storybook::infrastructure::codec
{
[[nodiscard]] std::vector<domain::StoryBookGame> ReadStoryBookPayload(const nlohmann::json& payload);
}
