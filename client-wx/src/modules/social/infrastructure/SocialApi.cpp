#include "modules/social/infrastructure/SocialApi.h"

#include <stdexcept>
#include <utility>

#include "modules/session/application/SessionStore.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::social::infrastructure
{
namespace
{
void EnsurePayloadObjectOrNull(
    const nlohmann::json& payload,
    const char* fallbackMessage)
{
    if (!payload.is_object() && !payload.is_null())
    {
        throw std::runtime_error(fallbackMessage);
    }
}
}

using lila::shared::data::json::ReadOptionalBool;
using lila::shared::data::json::ReadOptionalString;

SocialApi::SocialApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore)
    : client_(client),
      sessionStore_(sessionStore)
{
}

std::vector<domain::SocialUser> SocialApi::GetFriends() const
{
    const std::string event = std::string(lila::shared::contracts::social::FriendsListEvent);
    const auto response = Send(event, nlohmann::json::object(), lila::shared::errors::SocialLoadFriendsFailed);
    return ReadUsersPayload(event, response.payload);
}

std::vector<domain::SocialFriendRequest> SocialApi::GetRequests(const std::string& direction) const
{
    const std::string event = std::string(lila::shared::contracts::social::FriendsRequestsEvent);
    const auto response = Send(
        event,
        {{std::string(lila::shared::contracts::social::DirectionField),
          direction}},
        lila::shared::errors::SocialLoadRequestsFailed);
    return ReadRequestsPayload(event, response.payload);
}

std::vector<domain::SocialUser> SocialApi::GetBlockedUsers() const
{
    const std::string event = std::string(lila::shared::contracts::social::FriendsBlockedEvent);
    const auto response = Send(event, nlohmann::json::object(), lila::shared::errors::SocialLoadBlockedUsersFailed);
    return ReadUsersPayload(event, response.payload);
}

bool SocialApi::RequestFriend(int userId) const
{
    Send(
        std::string(lila::shared::contracts::social::FriendsRequestEvent),
        {{std::string(lila::shared::contracts::social::UserIdField), userId}},
        lila::shared::errors::SocialRequestFriendFailed);
    return true;
}

bool SocialApi::AcceptFriend(int userId) const
{
    Send(
        std::string(lila::shared::contracts::social::FriendsAcceptEvent),
        {{std::string(lila::shared::contracts::social::UserIdField), userId}},
        lila::shared::errors::SocialAcceptFriendFailed);
    return true;
}

bool SocialApi::RejectFriend(int userId) const
{
    Send(
        std::string(lila::shared::contracts::social::FriendsRejectEvent),
        {{std::string(lila::shared::contracts::social::UserIdField), userId}},
        lila::shared::errors::SocialRejectFriendFailed);
    return true;
}

bool SocialApi::CancelRequest(int userId) const
{
    Send(
        std::string(lila::shared::contracts::social::FriendsCancelEvent),
        {{std::string(lila::shared::contracts::social::UserIdField), userId}},
        lila::shared::errors::SocialCancelRequestFailed);
    return true;
}

bool SocialApi::RemoveFriend(int userId) const
{
    Send(
        std::string(lila::shared::contracts::social::FriendsRemoveEvent),
        {{std::string(lila::shared::contracts::social::UserIdField), userId}},
        lila::shared::errors::SocialRemoveFriendFailed);
    return true;
}

bool SocialApi::BlockUser(int userId) const
{
    Send(
        std::string(lila::shared::contracts::social::FriendsBlockEvent),
        {{std::string(lila::shared::contracts::social::UserIdField), userId}},
        lila::shared::errors::SocialBlockUserFailed);
    return true;
}

bool SocialApi::UnblockUser(int userId) const
{
    Send(
        std::string(lila::shared::contracts::social::FriendsUnblockEvent),
        {{std::string(lila::shared::contracts::social::UserIdField), userId}},
        lila::shared::errors::SocialUnblockUserFailed);
    return true;
}

std::optional<domain::SocialProfile> SocialApi::GetProfile(std::optional<int> userId) const
{
    nlohmann::json payload = nlohmann::json::object();
    if (userId.has_value())
    {
        payload[std::string(lila::shared::contracts::social::UserIdField)] = *userId;
    }

    const auto response = Send(
        std::string(lila::shared::contracts::social::ProfileGetEvent),
        std::move(payload),
        lila::shared::errors::SocialLoadProfileFailed);

    EnsurePayloadObjectOrNull(response.payload, lila::shared::errors::SocialResponsePayloadInvalidType);

    const auto profileIt = response.payload.find(std::string(lila::shared::contracts::social::ProfileItemsKey));
    if (profileIt == response.payload.end() || profileIt->is_null())
    {
        return std::nullopt;
    }

    if (!profileIt->is_object())
    {
        throw std::runtime_error(lila::shared::errors::SocialProfileMustBeObject);
    }

    return ReadProfile(*profileIt);
}

std::optional<domain::SocialProfile> SocialApi::UpdateProfile(const domain::SocialProfileUpdate& update) const
{
    const auto response = Send(
        std::string(lila::shared::contracts::social::ProfileUpdateEvent),
        {
            {std::string(lila::shared::contracts::social::SocialBioField), update.bio},
            {std::string(lila::shared::contracts::social::SocialVictoryMessageField), update.victoryMessage},
            {std::string(lila::shared::contracts::social::SocialDefeatMessageField), update.defeatMessage},
            {std::string(lila::shared::contracts::social::SocialVisibilityField), update.visibility},
        },
        lila::shared::errors::SocialUpdateProfileFailed);

    EnsurePayloadObjectOrNull(response.payload, lila::shared::errors::SocialResponsePayloadInvalidType);

    const auto profileIt = response.payload.find(std::string(lila::shared::contracts::social::ProfileItemsKey));
    if (profileIt == response.payload.end() || profileIt->is_null())
    {
        return std::nullopt;
    }

    if (!profileIt->is_object())
    {
        throw std::runtime_error(lila::shared::errors::SocialProfileUpdatedMustBeObject);
    }

    return ReadProfile(*profileIt);
}

std::vector<domain::SocialUser> SocialApi::ReadUsersPayload(
    const std::string& type,
    const nlohmann::json& payload) const
{
    EnsurePayloadObjectOrNull(payload, lila::shared::errors::SocialResponsePayloadInvalidType);

    const auto itemsIt = payload.find(std::string(lila::shared::contracts::social::ItemsKey));
    if (itemsIt == payload.end() || itemsIt->is_null())
    {
        return {};
    }

    if (!itemsIt->is_array())
    {
        throw std::runtime_error(lila::shared::errors::SocialListArrayPrefix + type + lila::shared::errors::SocialListArraySuffix);
    }

    std::vector<domain::SocialUser> users;
    users.reserve(itemsIt->size());
    for (const auto& item : *itemsIt)
    {
        if (!item.is_object())
        {
            throw std::runtime_error(lila::shared::errors::SocialEachUserMustBeObject);
        }

        users.push_back(ReadUser(item));
    }

    return users;
}

std::vector<domain::SocialFriendRequest> SocialApi::ReadRequestsPayload(
    const std::string& type,
    const nlohmann::json& payload) const
{
    EnsurePayloadObjectOrNull(payload, lila::shared::errors::SocialResponsePayloadInvalidType);

    const auto itemsIt = payload.find(std::string(lila::shared::contracts::social::ItemsKey));
    if (itemsIt == payload.end() || itemsIt->is_null())
    {
        return {};
    }

    if (!itemsIt->is_array())
    {
        throw std::runtime_error(lila::shared::errors::SocialListArrayPrefix + type + lila::shared::errors::SocialListArraySuffix);
    }

    std::vector<domain::SocialFriendRequest> requests;
    requests.reserve(itemsIt->size());
    for (const auto& item : *itemsIt)
    {
        if (!item.is_object())
        {
            throw std::runtime_error(lila::shared::errors::SocialEachRequestMustBeObject);
        }

        requests.push_back(ReadRequest(item));
    }

    return requests;
}

std::vector<domain::SocialUser> SocialApi::SearchUsers(const std::string& query) const
{
    const auto response = Send(
        std::string(lila::shared::contracts::social::ProfileSearchEvent),
        {{std::string(lila::shared::contracts::social::QueryField), query}},
        lila::shared::errors::SocialSearchUsersFailed);
    return ReadUsersPayload(std::string(lila::shared::contracts::social::ProfileSearchEvent), response.payload);
}

domain::SocialUser SocialApi::ReadUser(const nlohmann::json& source)
{
    domain::SocialUser user;
    user.id = lila::shared::data::json::ReadOptionalInteger(
        source, lila::shared::contracts::social::SearchFieldId.data());
    user.username = ReadOptionalString(source, lila::shared::contracts::social::SearchFieldUsername.data());
    user.avatar = ReadOptionalString(source, lila::shared::contracts::social::SearchFieldAvatar.data());
    user.since = ReadOptionalString(source, lila::shared::contracts::social::SearchFieldSince.data());
    user.createdAt = ReadOptionalString(source, lila::shared::contracts::social::SearchFieldCreatedAt.data());
    user.blockedAt = ReadOptionalString(source, lila::shared::contracts::social::SearchFieldBlockedAt.data());
    user.profileVisibility = ReadOptionalString(
        source,
        lila::shared::contracts::social::SearchFieldProfileVisibility.data());
    return user;
}

domain::SocialFriendRequest SocialApi::ReadRequest(const nlohmann::json& source)
{
    domain::SocialFriendRequest request;
    request.id = lila::shared::data::json::ReadOptionalInteger(
        source, lila::shared::contracts::social::SearchFieldId.data());
    request.createdAt = ReadOptionalString(source, lila::shared::contracts::social::SocialCreatedAtField.data());

    const auto requesterIt = source.find(std::string(lila::shared::contracts::social::SocialRequesterField));
    if (requesterIt != source.end() && requesterIt->is_object())
    {
        request.requester = ReadUser(*requesterIt);
    }

    const auto addresseeIt = source.find(std::string(lila::shared::contracts::social::SocialAddresseeField));
    if (addresseeIt != source.end() && addresseeIt->is_object())
    {
        request.addressee = ReadUser(*addresseeIt);
    }

    return request;
}

domain::SocialProfile SocialApi::ReadProfile(const nlohmann::json& source)
{
    domain::SocialProfile profile;
    const auto userIt = source.find(std::string(lila::shared::contracts::social::SocialProfileField));
    if (userIt != source.end() && userIt->is_object())
    {
        profile.user = ReadUser(*userIt);
    }

    profile.bio = ReadOptionalString(source, lila::shared::contracts::social::SocialBioField.data());
    profile.victoryMessage = ReadOptionalString(source, lila::shared::contracts::social::SocialVictoryMessageField.data());
    profile.defeatMessage = ReadOptionalString(source, lila::shared::contracts::social::SocialDefeatMessageField.data());
    profile.visibility = ReadOptionalString(source, lila::shared::contracts::social::SocialVisibilityField.data());
    if (profile.visibility.empty())
    {
        profile.visibility = "public";
    }
    profile.createdAt = ReadOptionalString(source, lila::shared::contracts::social::SocialCreatedAtField.data());
    profile.updatedAt = ReadOptionalString(source, lila::shared::contracts::social::SocialUpdatedAtField.data());
    profile.isOwner = ReadOptionalBool(source, lila::shared::contracts::social::SocialIsOwnerField.data(), false);
    profile.canView = ReadOptionalBool(source, lila::shared::contracts::social::SocialCanViewField.data(), false);
    return profile;
}

lila::shared::network::realtime::RealtimeApiResponse SocialApi::Send(
    const std::string& type,
    nlohmann::json payload,
    const std::string& fallbackMessage) const
{
    auto response = lila::shared::network::realtime::helpers::SendAndCheckAuth(
        client_, sessionStore_, lila::shared::errors::NoActiveSocialSession, type, std::move(payload));
    lila::shared::network::realtime::helpers::EnsureSuccessOrThrow(response, sessionStore_, fallbackMessage);
    return response;
}
}
