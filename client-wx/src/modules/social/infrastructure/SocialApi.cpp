#include "modules/social/infrastructure/SocialApi.h"
#include "modules/social/infrastructure/SocialPayloadCodec.h"

#include <utility>

#include "modules/session/application/SessionStore.h"
#include "modules/social/infrastructure/SocialProtocolFields.h"
#include "modules/social/domain/SocialErrorMessages.h"
#include "shared/network/domain/WsMessageTypes.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiHelpers.h"

namespace lila::modules::social::infrastructure
{
SocialApi::SocialApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore)
    : client_(client),
      sessionStore_(sessionStore)
{
}

std::vector<domain::SocialUser> SocialApi::GetFriends() const
{
    const std::string event = std::string(lila::shared::network::ws::types::social::FriendsList);
    const auto response = Send(event, nlohmann::json::object(), lila::shared::errors::SocialLoadFriendsFailed);
    return codec::ReadUsersPayload(event, response.payload);
}

std::vector<domain::SocialFriendRequest> SocialApi::GetRequests(const std::string& direction) const
{
    const std::string event = std::string(lila::shared::network::ws::types::social::FriendsRequests);
    const auto response = Send(
        event,
        {{std::string(lila::modules::social::infrastructure::fields::Direction), direction}},
        lila::shared::errors::SocialLoadRequestsFailed);
    return codec::ReadRequestsPayload(event, response.payload);
}

std::vector<domain::SocialUser> SocialApi::GetBlockedUsers() const
{
    const std::string event = std::string(lila::shared::network::ws::types::social::FriendsBlocked);
    const auto response = Send(event, nlohmann::json::object(), lila::shared::errors::SocialLoadBlockedUsersFailed);
    return codec::ReadUsersPayload(event, response.payload);
}

bool SocialApi::RequestFriend(int userId) const
{
    return Send(
        std::string(lila::shared::network::ws::types::social::FriendsRequest),
        {{std::string(lila::modules::social::infrastructure::fields::UserId), userId}},
        lila::shared::errors::SocialRequestFriendFailed).success;
}

bool SocialApi::AcceptFriend(int userId) const
{
    return Send(
        std::string(lila::shared::network::ws::types::social::FriendsAccept),
        {{std::string(lila::modules::social::infrastructure::fields::UserId), userId}},
        lila::shared::errors::SocialAcceptFriendFailed).success;
}

bool SocialApi::RejectFriend(int userId) const
{
    return Send(
        std::string(lila::shared::network::ws::types::social::FriendsReject),
        {{std::string(lila::modules::social::infrastructure::fields::UserId), userId}},
        lila::shared::errors::SocialRejectFriendFailed).success;
}

bool SocialApi::CancelRequest(int userId) const
{
    return Send(
        std::string(lila::shared::network::ws::types::social::FriendsCancel),
        {{std::string(lila::modules::social::infrastructure::fields::UserId), userId}},
        lila::shared::errors::SocialCancelRequestFailed).success;
}

bool SocialApi::RemoveFriend(int userId) const
{
    return Send(
        std::string(lila::shared::network::ws::types::social::FriendsRemove),
        {{std::string(lila::modules::social::infrastructure::fields::UserId), userId}},
        lila::shared::errors::SocialRemoveFriendFailed).success;
}

bool SocialApi::BlockUser(int userId) const
{
    return Send(
        std::string(lila::shared::network::ws::types::social::FriendsBlock),
        {{std::string(lila::modules::social::infrastructure::fields::UserId), userId}},
        lila::shared::errors::SocialBlockUserFailed).success;
}

bool SocialApi::UnblockUser(int userId) const
{
    return Send(
        std::string(lila::shared::network::ws::types::social::FriendsUnblock),
        {{std::string(lila::modules::social::infrastructure::fields::UserId), userId}},
        lila::shared::errors::SocialUnblockUserFailed).success;
}

std::optional<domain::SocialProfile> SocialApi::GetProfile(std::optional<int> userId) const
{
    nlohmann::json payload = nlohmann::json::object();
    if (userId.has_value())
    {
        payload[std::string(lila::modules::social::infrastructure::fields::UserId)] = *userId;
    }

    const auto response = Send(
        std::string(lila::shared::network::ws::types::social::ProfileGet),
        std::move(payload),
        lila::shared::errors::SocialLoadProfileFailed);

    return codec::ReadProfilePayload(response, lila::shared::errors::SocialProfileMustBeObject);
}

std::optional<domain::SocialProfile> SocialApi::UpdateProfile(const domain::SocialProfileUpdate& update) const
{
    const auto response = Send(
        std::string(lila::shared::network::ws::types::social::ProfileUpdate),
        {
            {std::string(lila::modules::social::infrastructure::fields::SocialBio), update.bio},
            {std::string(lila::modules::social::infrastructure::fields::SocialVictoryMessage), update.victoryMessage},
            {std::string(lila::modules::social::infrastructure::fields::SocialDefeatMessage), update.defeatMessage},
            {std::string(lila::modules::social::infrastructure::fields::SocialVisibility), update.visibility},
        },
        lila::shared::errors::SocialUpdateProfileFailed);

    return codec::ReadProfilePayload(response, lila::shared::errors::SocialProfileUpdatedMustBeObject);
}

std::vector<domain::SocialUser> SocialApi::SearchUsers(const std::string& query) const
{
    const auto response = Send(
        std::string(lila::shared::network::ws::types::social::UserSearch),
        {{std::string(lila::modules::social::infrastructure::fields::Query), query}},
        lila::shared::errors::SocialSearchUsersFailed);
    return codec::ReadUsersPayload(std::string(lila::shared::network::ws::types::social::UserSearch), response.payload);
}

lila::shared::network::realtime::RealtimeApiResponse SocialApi::Send(
    const std::string& type,
    nlohmann::json payload,
    const std::string& fallbackMessage) const
{
    return lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_,
        sessionStore_,
        lila::shared::errors::NoActiveSocialSession,
        type,
        std::move(payload),
        fallbackMessage);
}
}
