#pragma once

#include <optional>
#include <string>

#include <nlohmann/json_fwd.hpp>

namespace lila::modules::admin::presentation
{
[[nodiscard]] std::optional<std::string> FormatAdminBugReportListTitle(
    const nlohmann::json& report);
}
