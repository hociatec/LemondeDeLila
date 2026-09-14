#pragma once

#include <string>
#include <vector>

#include <nlohmann/json_fwd.hpp>

namespace lila::modules::admin::presentation
{
struct AdminResultEntry final
{
    std::string label;
    std::string details;
};

struct AdminResultPresentation final
{
    std::string summary;
    std::string details;
    std::vector<AdminResultEntry> entries;
};

[[nodiscard]] std::string FormatAdminResult(const nlohmann::json& payload);
[[nodiscard]] AdminResultPresentation BuildAdminResultPresentation(
    const nlohmann::json& payload);
}
