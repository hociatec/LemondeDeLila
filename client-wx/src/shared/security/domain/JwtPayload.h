#pragma once

#include <cstdint>
#include <string>

#include <nlohmann/json_fwd.hpp>

namespace lila::shared::security
{
[[nodiscard]] nlohmann::json DecodeJwtPayload(const std::string& token);
[[nodiscard]] std::int64_t ReadJwtExpirationClaim(const nlohmann::json& payload);
[[nodiscard]] std::int64_t ReadJwtExpiration(const std::string& token);
}
