#include "modules/messaging/infrastructure/MessagingApi.h"

#include <optional>
#include <stdexcept>
#include <utility>

#include "modules/session/application/SessionStore.h"
#include "modules/messaging/infrastructure/MessagingProtocolFields.h"
#include "modules/user/infrastructure/remote/UserAuthFields.h"
#include "shared/network/WsMessageTypes.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"
#include "shared/network/realtime/RealtimePayloadReaders.h"
#include "shared/data/JsonApiHelpers.h"
#include "shared/data/JsonReaders.h"
#include "shared/data/DateTime.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::messaging::infrastructure
{
namespace
{
using lila::shared::data::json::ReadRequiredObjectStrict;

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

}

MessagingApi::MessagingApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore)
    : client_(client),
      sessionStore_(sessionStore)
{
}

std::vector<domain::MessagingMessage> MessagingApi::GetBox(domain::MessagingBox box, int limit) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Messages),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::Box), BoxToString(box)},
            {std::string(lila::modules::messaging::infrastructure::fields::Limit), limit},
        },
        lila::shared::errors::MessagingLoadBoxFailed);
    return ReadMessagesPayload(response);
}

std::vector<domain::MessagingMessage> MessagingApi::GetConversation(int userId, int limit) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Conversation),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::ConversationUserId), userId},
            {std::string(lila::modules::messaging::infrastructure::fields::Limit), limit},
        },
        lila::shared::errors::MessagingLoadConversationFailed);
    return ReadMessagesPayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Send(
    int recipientId,
    const std::string& text,
    const std::optional<std::string>& subject) const
{
    nlohmann::json payload = {
        {std::string(lila::modules::messaging::infrastructure::fields::RecipientId), recipientId},
        {std::string(lila::modules::messaging::infrastructure::fields::Text), text},
    };
    if (subject.has_value() && !subject->empty())
    {
        payload[std::string(lila::modules::messaging::infrastructure::fields::Subject)] = *subject;
    }

    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Send),
        std::move(payload),
        lila::shared::errors::MessagingSendFailed);
    return ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Delete(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Delete),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::MessageId), messageId},
        },
        lila::shared::errors::MessagingDeleteFailed);
    return ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Restore(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Restore),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::MessageId), messageId},
        },
        lila::shared::errors::MessagingRestoreFailed);
    return ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Purge(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Purge),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::MessageId), messageId},
        },
        lila::shared::errors::MessagingPurgeFailed);
    return ReadMessagePayload(response);
}

std::optional<domain::MessagingUser> MessagingApi::SearchUser(const std::string& query) const
{
    const auto response = SendRequest(
        std::string(lila::shared::network::ws::types::messaging::Search),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::Query), query},
        },
        lila::shared::errors::MessagingSearchUserFailed);

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

void MessagingApi::MarkRead(const std::string& messageId) const
{
    static_cast<void>(SendRequest(
        std::string(lila::shared::network::ws::types::messaging::MarkRead),
        {
            {std::string(lila::modules::messaging::infrastructure::fields::MessageId), messageId},
        },
        lila::shared::errors::MessagingMarkReadFailed));
}

std::vector<domain::MessagingMessage> MessagingApi::ReadMessagesPayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response) const
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

std::optional<domain::MessagingMessage> MessagingApi::ReadMessagePayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response) const
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

domain::MessagingMessage MessagingApi::ReadMessage(const nlohmann::json& source)
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
        source, lila::modules::messaging::infrastructure::fields::Direction.data()) == lila::modules::messaging::infrastructure::fields::SentDirection;
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

domain::MessagingUser MessagingApi::ReadUser(const nlohmann::json& source)
{
    domain::MessagingUser user;
    user.id = lila::shared::domain::UserId{
        lila::shared::data::json::ReadRequiredInteger(
            source, lila::modules::messaging::infrastructure::fields::Id.data())};
    user.username = lila::shared::data::json::ReadRequiredString(
        source, lila::modules::user::infrastructure::remote::fields::Username.data());
    return user;
}

lila::shared::network::realtime::RealtimeApiResponse MessagingApi::SendRequest(
    const std::string& type,
    nlohmann::json payload,
    const std::string& fallbackMessage) const
{
    return lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_,
        sessionStore_,
        lila::shared::errors::NoActiveMessagingSession,
        type,
        std::move(payload),
        fallbackMessage);
}
}

