#include "modules/social/infrastructure/SocialApi.h"

#include <stdexcept>
#include <utility>

#include "modules/session/application/SessionStore.h"
#include "modules/social/infrastructure/SocialProtocolFields.h"
#include "shared/network/WsMessageTypes.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"
#include "shared/network/realtime/RealtimePayloadReaders.h"
#include "shared/data/JsonApiHelpers.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::social::infrastructure
{
using lila::shared::data::json::ReadOptionalBool;
using lila::shared::data::json::ReadOptionalString;
using lila::shared::data::json::ReadRequiredBool;
using lila::shared::data::json::ReadRequiredString;
using lila::shared::data::json::ReadRequiredObjectStrict;

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
    return ReadUsersPayload(event, response.payload);
}

std::vector<domain::SocialFriendRequest> SocialApi::GetRequests(const std::string& direction) const
{
    const std::string event = std::string(lila::shared::network::ws::types::social::FriendsRequests);
    const auto response = Send(
        event,
        {{std::string(lila::modules::social::infrastructure::fields::Direction),
          direction}},
        lila::shared::errors::SocialLoadRequestsFailed);
    return ReadRequestsPayload(event, response.payload);
}

std::vector<domain::SocialUser> SocialApi::GetBlockedUsers() const
{
    const std::string event = std::string(lila::shared::network::ws::types::social::FriendsBlocked);
    const auto response = Send(event, nlohmann::json::object(), lila::shared::errors::SocialLoadBlockedUsersFailed);
    return ReadUsersPayload(event, response.payload);
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

    return lila::shared::network::realtime::payload::ReadOptionalObjectPayload(
        response.payload,
        lila::modules::social::infrastructure::fields::ProfileItems,
        lila::shared::errors::SocialResponsePayloadInvalidType,
        lila::shared::errors::SocialProfileMustBeObject,
        [](const nlohmann::json& profile)
        {
            return ReadProfile(profile);
        });
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

    return lila::shared::network::realtime::payload::ReadOptionalObjectPayload(
        response.payload,
        lila::modules::social::infrastructure::fields::ProfileItems,
        lila::shared::errors::SocialResponsePayloadInvalidType,
        lila::shared::errors::SocialProfileUpdatedMustBeObject,
        [](const nlohmann::json& profile)
        {
            return ReadProfile(profile);
        });
}

std::vector<domain::SocialUser> SocialApi::ReadUsersPayload(
    const std::string& type,
    const nlohmann::json& payload) const
{
    const std::string listError = lila::shared::errors::SocialListArrayPrefix + type + lila::shared::errors::SocialListArraySuffix;
    return lila::shared::network::realtime::payload::ReadObjectArrayPayload<domain::SocialUser>(
        payload,
        lila::modules::social::infrastructure::fields::Items,
        lila::shared::errors::SocialResponsePayloadInvalidType,
        listError.c_str(),
        lila::shared::errors::SocialEachUserMustBeObject,
        [](const nlohmann::json& item)
        {
            return ReadUser(item);
        });
}

std::vector<domain::SocialFriendRequest> SocialApi::ReadRequestsPayload(
    const std::string& type,
    const nlohmann::json& payload) const
{
    const std::string listError = lila::shared::errors::SocialListArrayPrefix + type + lila::shared::errors::SocialListArraySuffix;
    return lila::shared::network::realtime::payload::ReadObjectArrayPayload<domain::SocialFriendRequest>(
        payload,
        lila::modules::social::infrastructure::fields::Items,
        lila::shared::errors::SocialResponsePayloadInvalidType,
        listError.c_str(),
        lila::shared::errors::SocialEachRequestMustBeObject,
        [](const nlohmann::json& item)
        {
            return ReadRequest(item);
        });
}

std::vector<domain::SocialUser> SocialApi::SearchUsers(const std::string& query) const
{
    const auto response = Send(
        std::string(lila::shared::network::ws::types::social::UserSearch),
        {{std::string(lila::modules::social::infrastructure::fields::Query), query}},
        lila::shared::errors::SocialSearchUsersFailed);
    return ReadUsersPayload(std::string(lila::shared::network::ws::types::social::UserSearch), response.payload);
}

domain::SocialUser SocialApi::ReadUser(const nlohmann::json& source)
{
    domain::SocialUser user;
    user.id = lila::shared::domain::UserId{
        lila::shared::data::json::ReadRequiredInteger(
            source, lila::modules::social::infrastructure::fields::SearchId.data())};
    user.username = lila::shared::data::json::ReadRequiredString(
        source, lila::modules::social::infrastructure::fields::SearchUsername.data());
    user.avatar = ReadOptionalString(source, lila::modules::social::infrastructure::fields::SearchAvatar.data());
    user.since = ReadOptionalString(source, lila::modules::social::infrastructure::fields::SearchSince.data());
    user.createdAt = ReadOptionalString(source, lila::modules::social::infrastructure::fields::SearchCreatedAt.data());
    user.blockedAt = ReadOptionalString(source, lila::modules::social::infrastructure::fields::SearchBlockedAt.data());
    user.profileVisibility = lila::shared::domain::ProfileVisibilityFromString(
        ReadOptionalString(
            source,
            lila::modules::social::infrastructure::fields::SearchProfileVisibility.data()));
    return user;
}

domain::SocialFriendRequest SocialApi::ReadRequest(const nlohmann::json& source)
{
    domain::SocialFriendRequest request;
    request.id = lila::shared::domain::UserId{
        lila::shared::data::json::ReadRequiredInteger(
            source, lila::modules::social::infrastructure::fields::SearchId.data())};
    request.createdAt = ReadRequiredString(
        source, lila::modules::social::infrastructure::fields::SocialCreatedAt.data());
    request.requester = ReadUser(
        ReadRequiredObjectStrict(
            source,
            lila::modules::social::infrastructure::fields::SocialRequester.data(),
            lila::shared::errors::SocialEachRequestMustBeObject));
    request.addressee = ReadUser(
        ReadRequiredObjectStrict(
            source,
            lila::modules::social::infrastructure::fields::SocialAddressee.data(),
            lila::shared::errors::SocialEachRequestMustBeObject));

    return request;
}

domain::SocialProfile SocialApi::ReadProfile(const nlohmann::json& source)
{
    domain::SocialProfile profile;
    profile.user = ReadUser(
        ReadRequiredObjectStrict(
            source,
            lila::modules::social::infrastructure::fields::SocialProfile.data(),
            lila::shared::errors::SocialProfileMustBeObject));
    profile.bio = ReadRequiredString(source, lila::modules::social::infrastructure::fields::SocialBio.data());
    profile.victoryMessage = ReadRequiredString(source, lila::modules::social::infrastructure::fields::SocialVictoryMessage.data());
    profile.defeatMessage = ReadRequiredString(source, lila::modules::social::infrastructure::fields::SocialDefeatMessage.data());
    profile.visibility = lila::shared::domain::ProfileVisibilityFromString(
        ReadRequiredString(source, lila::modules::social::infrastructure::fields::SocialVisibility.data()));
    profile.createdAt = ReadRequiredString(source, lila::modules::social::infrastructure::fields::SocialCreatedAt.data());
    profile.updatedAt = ReadRequiredString(source, lila::modules::social::infrastructure::fields::SocialUpdatedAt.data());
    profile.isOwner = ReadRequiredBool(source, lila::modules::social::infrastructure::fields::SocialIsOwner.data());
    profile.canView = ReadRequiredBool(source, lila::modules::social::infrastructure::fields::SocialCanView.data());
    return profile;
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
