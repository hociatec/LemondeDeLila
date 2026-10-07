#pragma once

#include <cstddef>
#include <string>
#include <stop_token>

namespace lila::shared::network::http
{
[[nodiscard]] std::string RequestWsTicketResponse(
    const std::string& url,
    const std::string& bearerToken,
    std::size_t maximumResponseBytes = 32U * 1024U * 1024U,
    std::stop_token stopToken = {});
}
