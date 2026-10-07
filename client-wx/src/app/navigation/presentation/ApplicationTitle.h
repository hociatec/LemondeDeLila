#pragma once

#include <string>
#include <string_view>

#include "shared/config/domain/AppConfig.h"

namespace lila::app::navigation
{
[[nodiscard]] inline std::string ApplicationTitle(std::string_view username = {})
{
    std::string title(lila::shared::config::AppConfig::AppTitle);
    if (!username.empty())
    {
        title += " - ";
        title += username;
    }
    return title;
}
}
