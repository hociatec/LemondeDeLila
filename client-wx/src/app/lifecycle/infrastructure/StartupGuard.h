#pragma once

#include <string>

namespace lila::bootstrap
{
class AppBootstrap;
}

namespace lila::app::lifecycle
{
[[nodiscard]] bool StartBootstrapSafely(
    lila::bootstrap::AppBootstrap& bootstrap,
    std::string& failureMessage);
}
