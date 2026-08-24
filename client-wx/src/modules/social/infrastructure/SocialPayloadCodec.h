#pragma once

#include <nlohmann/json.hpp>

#include <optional>
#include <string>
#include <vector>

#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::modules::social::infrastructure::codec
{
[[nodiscard]] std::vector<domain::SocialUser> ReadUsersPayload(
    const std::string& type,
    const nlohmann::json& payload);
[[nodiscard]] std::vector<domain::SocialFriendRequest> ReadRequestsPayload(
    const std::string& type,
    const nlohmann::json& payload);
[[nodiscard]] std::optional<domain::SocialProfile> ReadProfilePayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response,
    const char* objectError);
}
