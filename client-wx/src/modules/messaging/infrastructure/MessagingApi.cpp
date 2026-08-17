#include "modules/messaging/infrastructure/MessagingApi.h"

#include <ctime>
#include <iomanip>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <utility>

#include "modules/session/application/SessionStore.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::messaging::infrastructure
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

std::string BoxToString(domain::MessagingBox box)
{
    switch (box)
    {
    case domain::MessagingBox::Inbox:
        return std::string(lila::shared::contracts::messaging::InboxBox);
    case domain::MessagingBox::Outbox:
        return std::string(lila::shared::contracts::messaging::OutboxBox);
    case domain::MessagingBox::Deleted:
        return std::string(lila::shared::contracts::messaging::DeletedBox);
    }

    return std::string(lila::shared::contracts::messaging::InboxBox);
}

std::optional<std::time_t> ParseIsoTimestamp(const std::string& rawValue)
{
    if (rawValue.empty())
    {
        return std::nullopt;
    }

    std::string normalized = rawValue;
    if (!normalized.empty() && normalized.back() == 'Z')
    {
        normalized.pop_back();
    }

    const std::size_t fractionSeparator = normalized.find('.');
    if (fractionSeparator != std::string::npos)
    {
        normalized = normalized.substr(0, fractionSeparator);
    }

    std::tm parsed{};
    std::istringstream input(normalized);
    input >> std::get_time(&parsed, "%Y-%m-%dT%H:%M:%S");
    if (input.fail())
    {
        return std::nullopt;
    }

#ifdef _WIN32
    return _mkgmtime(&parsed);
#else
    return timegm(&parsed);
#endif
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
        std::string(lila::shared::contracts::messaging::MessagesEvent),
        {
            {std::string(lila::shared::contracts::messaging::BoxKey), BoxToString(box)},
            {std::string(lila::shared::contracts::messaging::LimitField), limit},
        },
        lila::shared::errors::MessagingLoadBoxFailed);
    return ReadMessagesPayload(response);
}

std::vector<domain::MessagingMessage> MessagingApi::GetConversation(int userId, int limit) const
{
    const auto response = SendRequest(
        std::string(lila::shared::contracts::messaging::ConversationEvent),
        {
            {std::string(lila::shared::contracts::messaging::ConversationUserIdField), userId},
            {std::string(lila::shared::contracts::messaging::LimitField), limit},
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
        {std::string(lila::shared::contracts::messaging::RecipientIdField), recipientId},
        {std::string(lila::shared::contracts::messaging::TextField), text},
    };
    if (subject.has_value() && !subject->empty())
    {
        payload[std::string(lila::shared::contracts::messaging::SubjectField)] = *subject;
    }

    const auto response = SendRequest(
        std::string(lila::shared::contracts::messaging::SendEvent),
        std::move(payload),
        lila::shared::errors::MessagingSendFailed);
    return ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Delete(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::contracts::messaging::DeleteEvent),
        {
            {std::string(lila::shared::contracts::messaging::MessageIdField), messageId},
        },
        lila::shared::errors::MessagingDeleteFailed);
    return ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Restore(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::contracts::messaging::RestoreEvent),
        {
            {std::string(lila::shared::contracts::messaging::MessageIdField), messageId},
        },
        lila::shared::errors::MessagingRestoreFailed);
    return ReadMessagePayload(response);
}

std::optional<domain::MessagingMessage> MessagingApi::Purge(const std::string& messageId) const
{
    const auto response = SendRequest(
        std::string(lila::shared::contracts::messaging::PurgeEvent),
        {
            {std::string(lila::shared::contracts::messaging::MessageIdField), messageId},
        },
        lila::shared::errors::MessagingPurgeFailed);
    return ReadMessagePayload(response);
}

std::optional<domain::MessagingUser> MessagingApi::SearchUser(const std::string& query) const
{
    const auto response = SendRequest(
        std::string(lila::shared::contracts::messaging::SearchEvent),
        {
            {std::string(lila::shared::contracts::messaging::QueryField), query},
        },
        lila::shared::errors::MessagingSearchUserFailed);

    EnsurePayloadObjectOrNull(response.payload, lila::shared::errors::MessagingResponsePayloadInvalidType);

    const auto userIt = response.payload.find(std::string(lila::shared::contracts::messaging::SearchResultKey));
    if (userIt == response.payload.end() || userIt->is_null())
    {
        return std::nullopt;
    }

    if (!userIt->is_object())
    {
        throw std::runtime_error(lila::shared::errors::MessagingUsersMustBeObject);
    }

    return ReadUser(*userIt);
}

void MessagingApi::MarkRead(const std::string& messageId) const
{
    SendRequest(
        std::string(lila::shared::contracts::messaging::MarkReadEvent),
        {
            {std::string(lila::shared::contracts::messaging::MessageIdField), messageId},
        },
        lila::shared::errors::MessagingMarkReadFailed);
}

std::vector<domain::MessagingMessage> MessagingApi::ReadMessagesPayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response) const
{
    EnsurePayloadObjectOrNull(response.payload, lila::shared::errors::MessagingResponsePayloadInvalidType);

    const auto itemsIt = response.payload.find(std::string(lila::shared::contracts::messaging::ItemsKey));
    if (itemsIt == response.payload.end() || itemsIt->is_null())
    {
        return {};
    }

    if (!itemsIt->is_array())
    {
        throw std::runtime_error(lila::shared::errors::MessagingMessagesMustBeArray);
    }

    std::vector<domain::MessagingMessage> messages;
    messages.reserve(itemsIt->size());
    for (const auto& item : *itemsIt)
    {
        if (!item.is_object())
        {
            throw std::runtime_error(lila::shared::errors::MessagingEachMessageMustBeObject);
        }

        messages.push_back(ReadMessage(item));
    }

    return messages;
}

std::optional<domain::MessagingMessage> MessagingApi::ReadMessagePayload(
    const lila::shared::network::realtime::RealtimeApiResponse& response) const
{
    EnsurePayloadObjectOrNull(response.payload, lila::shared::errors::MessagingResponsePayloadInvalidType);

    const auto messageIt = response.payload.find(std::string(lila::shared::contracts::messaging::MessageKey));
    if (messageIt == response.payload.end() || messageIt->is_null())
    {
        return std::nullopt;
    }

    if (!messageIt->is_object())
    {
        throw std::runtime_error(lila::shared::errors::MessagingMessageMustBeObject);
    }

    return ReadMessage(*messageIt);
}

domain::MessagingMessage MessagingApi::ReadMessage(const nlohmann::json& source)
{
    domain::MessagingMessage message;
    message.id = ReadOptionalString(source, lila::shared::contracts::messaging::IdField.data());
    message.subject = ReadOptionalString(source, lila::shared::contracts::messaging::SubjectField.data());
    message.text = ReadOptionalString(source, lila::shared::contracts::messaging::TextField.data());
    message.createdAtUtc = ReadOptionalTimestamp(source, lila::shared::contracts::messaging::CreatedAtField.data());
    message.isSent =
        ReadOptionalString(source, lila::shared::contracts::messaging::DirectionField.data()) == lila::shared::contracts::messaging::SentDirection;
    message.isDeleted = !ReadOptionalString(source, lila::shared::contracts::messaging::DeletedAtField.data()).empty();
    message.boxType = ReadOptionalString(source, lila::shared::contracts::messaging::BoxTypeField.data());

    const auto senderIt = source.find(std::string(lila::shared::contracts::messaging::SenderField));
    if (senderIt != source.end() && senderIt->is_object())
    {
        message.sender = ReadUser(*senderIt);
    }

    const auto recipientIt = source.find(std::string(lila::shared::contracts::messaging::RecipientField));
    if (recipientIt != source.end() && recipientIt->is_object())
    {
        message.recipient = ReadUser(*recipientIt);
    }

    return message;
}

domain::MessagingUser MessagingApi::ReadUser(const nlohmann::json& source)
{
    domain::MessagingUser user;
    user.id = lila::shared::data::json::ReadOptionalInteger(
        source, lila::shared::contracts::messaging::IdField.data());
    user.username = ReadOptionalString(source, lila::shared::contracts::user::UsernameField.data());
    return user;
}

std::string MessagingApi::ReadOptionalString(const nlohmann::json& source, const char* fieldName)
{
    return lila::shared::data::json::ReadOptionalString(source, fieldName);
}

std::time_t MessagingApi::ReadOptionalTimestamp(const nlohmann::json& source, const char* fieldName)
{
    return ParseIsoTimestamp(ReadOptionalString(source, fieldName)).value_or(std::time(nullptr));
}

lila::shared::network::realtime::RealtimeApiResponse MessagingApi::SendRequest(
    const std::string& type,
    nlohmann::json payload,
    const std::string& fallbackMessage) const
{
    const auto response = lila::shared::network::realtime::helpers::SendAndCheckAuth(
        client_, sessionStore_, lila::shared::errors::NoActiveMessagingSession, type, std::move(payload));
    lila::shared::network::realtime::helpers::EnsureSuccessOrThrow(
        response,
        sessionStore_,
        fallbackMessage);
    return response;
}
}

