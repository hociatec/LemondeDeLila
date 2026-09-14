#pragma once

#include <string>

#include <nlohmann/json_fwd.hpp>

namespace lila::modules::admin::presentation
{
[[nodiscard]] std::string FormatAdminResult(const nlohmann::json& payload);
}
