#pragma once

#include <string>

namespace lila::shared::network::http
{
[[nodiscard]] std::string RequestWsTicketResponse(const std::string& url, const std::string& bearerToken);
}
