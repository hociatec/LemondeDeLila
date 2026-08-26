#include "modules/social/infrastructure/SocialPayloadCodec.h"

#include "modules/social/infrastructure/SocialProtocolFields.h"
#include "shared/data/json/JsonApiHelpers.h"
#include "shared/data/json/JsonReaders.h"
#include "modules/social/domain/SocialErrorMessages.h"
#include "shared/network/application/realtime/RealtimePayloadReaders.h"

namespace lila::modules::social::infrastructure::codec
{
namespace
{
using lila::shared::data::json::ReadOptionalString;
using lila::shared::data::json::ReadRequiredBool;
using lila::shared::data::json::ReadRequiredObjectStrict;
using lila::shared::data::json::ReadRequiredString;

domain::SocialUser ReadUser(const nlohmann::json& source)
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

domain::SocialFriendRequest ReadRequest(const nlohmann::json& source)
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

domain::SocialProfile ReadProfile(const nlohmann::json& source)
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
}

std::vector<domain::SocialUser> ReadUsersPayload(
    const std::string& type,
    const nlohmann::json& payload)
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

std::vector<domain::SocialFriendRequest> ReadRequestsPayload(
    const std::string& type,
    const nlohmann::json& payload)
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

std::optional<domain::SocialProfile> ReadProfilePayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response,
    const char* objectError)
{
    return lila::shared::network::realtime::payload::ReadOptionalObjectPayload(
        response.payload,
        lila::modules::social::infrastructure::fields::ProfileItems,
        lila::shared::errors::SocialResponsePayloadInvalidType,
        objectError,
        [](const nlohmann::json& profile)
        {
            return ReadProfile(profile);
        });
}
}
