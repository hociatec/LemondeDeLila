#pragma once

#include <nlohmann/json_fwd.hpp>
#include <wx/string.h>

namespace lila::modules::admin::presentation
{
[[nodiscard]] wxString FormatAdminBugReport(const nlohmann::json& payload);
}
