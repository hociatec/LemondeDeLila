#pragma once

#include <nlohmann/json.hpp>

#include <optional>
#include <string>
#include <vector>

#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "modules/social/application/ISocialGateway.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::shared::network::realtime
{
class AuthenticatedRealtimeApiClient;
}

namespace lila::modules::social::infrastructure
{
class SocialApi final : public lila::modules::social::application::ISocialGateway
{
public:
    SocialApi(
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
        lila::modules::session::application::SessionStore& sessionStore);

    [[nodiscard]] std::vector<domain::SocialUser> GetFriends() const override;
    [[nodiscard]] std::vector<domain::SocialFriendRequest> GetRequests(const std::string& direction) const override;
    [[nodiscard]] std::vector<domain::SocialUser> GetBlockedUsers() const override;
    [[nodiscard]] bool RequestFriend(int userId) const override;
    [[nodiscard]] bool AcceptFriend(int userId) const override;
    [[nodiscard]] bool RejectFriend(int userId) const override;
    [[nodiscard]] bool CancelRequest(int userId) const override;
    [[nodiscard]] bool RemoveFriend(int userId) const override;
    [[nodiscard]] bool BlockUser(int userId) const override;
    [[nodiscard]] bool UnblockUser(int userId) const override;
    [[nodiscard]] std::vector<domain::SocialUser> SearchUsers(const std::string& query) const override;
    [[nodiscard]] std::optional<domain::SocialProfile> GetProfile(std::optional<int> userId) const override;
    [[nodiscard]] std::optional<domain::SocialProfile> UpdateProfile(const domain::SocialProfileUpdate& update) const override;

private:
    [[nodiscard]] lila::shared::network::realtime::RealtimeApiResponse Send(
        const std::string& type,
        nlohmann::json payload,
        const std::string& fallbackMessage) const;

    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& sessionStore_;
};
}
