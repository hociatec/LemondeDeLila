#include "modules/messaging/infrastructure/MessagingPayloadCodec.h"

#include <stdexcept>

#include "modules/messaging/infrastructure/MessagingProtocolFields.h"
#include "modules/user/infrastructure/remote/UserAuthFields.h"
#include "shared/data/DateTime.h"
#include "shared/data/JsonApiHelpers.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/network/realtime/RealtimePayloadReaders.h"

namespace lila::modules::messaging::infrastructure::codec
{
namespace
{
using lila::shared::data::json::ReadRequiredObjectStrict;

std::time_t ParseRequiredIsoTimestamp(const std::string& rawValue)
{
    if (rawValue.empty())
    {
        throw std::runtime_error(lila::shared::errors::MessagingCreatedAtMissing);
    }

    const auto timestamp = lila::shared::data::datetime::ParseIsoTimestamp(rawValue);
    if (!timestamp.has_value())
    {
        throw std::runtime_error(lila::shared::errors::MessagingCreatedAtInvalid);
    }

    return *timestamp;
}

domain::MessagingUser ReadUser(const nlohmann::json& source)
{
    domain::MessagingUser user;
    user.id = lila::shared::domain::UserId{
        lila::shared::data::json::ReadRequiredInteger(
            source, lila::modules::messaging::infrastructure::fields::Id.data())};
    user.username = lila::shared::data::json::ReadRequiredString(
        source, lila::modules::user::infrastructure::remote::fields::Username.data());
    return user;
}

domain::MessagingMessage ReadMessage(const nlohmann::json& source)
{
    domain::MessagingMessage message;
    message.id = lila::shared::domain::MessageId{
        lila::shared::data::json::ReadRequiredString(
            source, lila::modules::messaging::infrastructure::fields::Id.data())};
    message.subject = lila::shared::data::json::ReadOptionalString(
        source, lila::modules::messaging::infrastructure::fields::Subject.data());
    message.text = lila::shared::data::json::ReadRequiredString(
        source, lila::modules::messaging::infrastructure::fields::Text.data());
    message.createdAtUtc = ParseRequiredIsoTimestamp(
        lila::shared::data::json::ReadRequiredString(
            source, lila::modules::messaging::infrastructure::fields::CreatedAt.data()));
    message.isSent = lila::shared::data::json::ReadRequiredString(
        source, lila::modules::messaging::infrastructure::fields::Direction.data()) ==
        lila::modules::messaging::infrastructure::fields::SentDirection;
    message.isDeleted = !lila::shared::data::json::ReadOptionalString(
        source, lila::modules::messaging::infrastructure::fields::DeletedAt.data()).empty();
    message.boxType = lila::shared::data::json::ReadRequiredString(
        source, lila::modules::messaging::infrastructure::fields::BoxType.data());
    message.sender = ReadUser(
        ReadRequiredObjectStrict(
            source,
            lila::modules::messaging::infrastructure::fields::Sender.data(),
            lila::shared::errors::MessagingUsersMustBeObject));
    message.recipient = ReadUser(
        ReadRequiredObjectStrict(
            source,
            lila::modules::messaging::infrastructure::fields::Recipient.data(),
            lila::shared::errors::MessagingUsersMustBeObject));
    return message;
}
}

std::string BoxToString(domain::MessagingBox box)
{
    switch (box)
    {
    case domain::MessagingBox::Inbox:
        return std::string(lila::modules::messaging::infrastructure::fields::InboxBox);
    case domain::MessagingBox::Outbox:
        return std::string(lila::modules::messaging::infrastructure::fields::OutboxBox);
    case domain::MessagingBox::Deleted:
        return std::string(lila::modules::messaging::infrastructure::fields::DeletedBox);
    }

    throw std::invalid_argument(lila::shared::errors::MessagingInvalidBox);
}

std::vector<domain::MessagingMessage> ReadMessagesPayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response)
{
    return lila::shared::network::realtime::payload::ReadObjectArrayPayload<domain::MessagingMessage>(
        response.payload,
        lila::modules::messaging::infrastructure::fields::Items,
        lila::shared::errors::MessagingResponsePayloadInvalidType,
        lila::shared::errors::MessagingMessagesMustBeArray,
        lila::shared::errors::MessagingEachMessageMustBeObject,
        [](const nlohmann::json& item)
        {
            return ReadMessage(item);
        });
}

std::optional<domain::MessagingMessage> ReadMessagePayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response)
{
    return lila::shared::network::realtime::payload::ReadOptionalObjectPayload(
        response.payload,
        lila::modules::messaging::infrastructure::fields::Message,
        lila::shared::errors::MessagingResponsePayloadInvalidType,
        lila::shared::errors::MessagingMessageMustBeObject,
        [](const nlohmann::json& message)
        {
            return ReadMessage(message);
        });
}

std::optional<domain::MessagingUser> ReadSearchUserPayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response)
{
    const auto* user = lila::shared::network::realtime::payload::ReadOptionalObjectField(
        response.payload,
        lila::modules::messaging::infrastructure::fields::SearchResult,
        lila::shared::errors::MessagingResponsePayloadInvalidType,
        lila::shared::errors::MessagingUsersMustBeObject);
    if (user == nullptr)
    {
        return std::nullopt;
    }

    return ReadUser(*user);
}
}
