#include "modules/chat/infrastructure/ChatEventPayloadParser.h"

#include "modules/chat/infrastructure/ChatProtocolFields.h"
#include "shared/data/time/DateTime.h"
#include "shared/data/json/JsonReaders.h"
#include "modules/chat/domain/ChatErrorMessages.h"
#include "shared/network/domain/WsMessageTypes.h"
#include "shared/network/application/realtime/RealtimeProtocolFields.h"

#include <optional>
#include <stdexcept>

#include <nlohmann/json.hpp>

namespace lila::modules::chat::infrastructure::codec::detail
{
using lila::modules::chat::domain::ChatServerError;
using lila::modules::chat::infrastructure::ChatEvent;
using lila::modules::chat::infrastructure::ChatEventType;

using lila::shared::data::json::ReadOptionalString;
using lila::shared::data::json::ReadRequiredInteger;
using lila::shared::data::json::ReadRequiredString;

bool IsChatEventType(const std::string& type)
{
    return type == std::string(lila::shared::network::ws::types::chat::History) ||
        type == std::string(lila::shared::network::ws::types::chat::Message) ||
        type == std::string(lila::shared::network::ws::types::chat::MessageUpdated) ||
        type == std::string(lila::shared::network::ws::types::chat::MessageDeleted) ||
        type == std::string(lila::shared::network::ws::types::chat::Error);
}

const nlohmann::json* FindPayloadObject(const nlohmann::json& root)
{
    const auto payloadIterator = root.find(std::string(lila::modules::chat::infrastructure::fields::Payload));
    if (payloadIterator == root.end() || payloadIterator->is_null())
    {
        return &root;
    }

    if (!payloadIterator->is_object())
    {
        throw std::runtime_error(lila::shared::errors::ChatActionInvalidPayload);
    }

    return &(*payloadIterator);
}

const nlohmann::json* FindPayloadObjectOrRoot(const nlohmann::json& root)
{
    const auto payloadIterator = root.find(std::string(lila::modules::chat::infrastructure::fields::Payload));
    if (payloadIterator == root.end() || payloadIterator->is_null())
    {
        return &root;
    }

    if (!payloadIterator->is_object())
    {
        return &root;
    }

    return &(*payloadIterator);
}

const nlohmann::json& RequireArrayField(
    const nlohmann::json& root,
    const char* fieldName,
    const char* contextMessage)
{
    static const nlohmann::json defaultValue = nlohmann::json::array();

    const auto iterator = root.find(fieldName);
    if (iterator == root.end() || iterator->is_null())
    {
        return defaultValue;
    }

    if (!iterator->is_array())
    {
        throw std::runtime_error(contextMessage);
    }

    return *iterator;
}

const nlohmann::json* FindErrorContainer(
    const nlohmann::json& root,
    const nlohmann::json& payload)
{
    const auto errorIterator = root.find(std::string(lila::shared::network::realtime::fields::Error));
    if (errorIterator != root.end() && errorIterator->is_object())
    {
        return &(*errorIterator);
    }

    const auto payloadErrorIterator = payload.find(std::string(lila::shared::network::realtime::fields::Error));
    if (payloadErrorIterator != payload.end() && payloadErrorIterator->is_object())
    {
        return &(*payloadErrorIterator);
    }

    return &payload;
}

ChatEvent BuildErrorEvent(const std::string& message)
{
    ChatEvent event;
    event.type = ChatEventType::Error;
    event.error = ChatServerError{message, {}, std::nullopt};
    return event;
}

lila::modules::chat::domain::ChatMessage ParseChatMessage(
    const nlohmann::json& payload,
    int currentUserId,
    std::time_t nowUtc)
{
    lila::modules::chat::domain::ChatMessage message;
    message.id = ReadRequiredString(
        payload, lila::modules::chat::infrastructure::fields::Id.data());
    message.text = ReadRequiredString(
        payload, lila::modules::chat::infrastructure::fields::Text.data());
    const auto userIterator = payload.find(std::string(lila::modules::chat::infrastructure::fields::User));
    if (userIterator == payload.end() || !userIterator->is_object())
    {
        throw std::runtime_error(lila::shared::errors::ChatActionInvalidPayload);
    }

    message.user = ReadRequiredString(*userIterator, lila::modules::chat::infrastructure::fields::Username.data());
    message.userId = ReadRequiredInteger(*userIterator, lila::modules::chat::infrastructure::fields::Id.data());

    message.timestampUtc = lila::shared::data::datetime::ParseIsoTimestamp(
        ReadRequiredString(payload, lila::modules::chat::infrastructure::fields::CreatedAt.data()))
                              .value_or(nowUtc);
    message.isMine = message.userId != 0 && message.userId == currentUserId;
    return message;
}

ChatEvent ParseHistoryEvent(const nlohmann::json& root, int currentUserId, std::time_t nowUtc)
{
    ChatEvent event;
    event.type = ChatEventType::History;
    event.editWindowSeconds = ReadRequiredInteger(
        root, lila::modules::chat::infrastructure::fields::EditWindowSeconds.data());
    const auto& messages = RequireArrayField(
        root,
        lila::modules::chat::infrastructure::fields::Messages.data(),
        lila::shared::errors::ChatMessagesMustBeArray);
    for (const auto& item : messages)
    {
        if (!item.is_object())
        {
            return BuildErrorEvent(lila::shared::errors::ChatEventDataInvalid);
        }
        event.messages.push_back(ParseChatMessage(item, currentUserId, nowUtc));
    }

    return event;
}

ChatEvent ParseMessageUpsertEvent(const nlohmann::json& root, int currentUserId, std::time_t nowUtc)
{
    const auto* payload = FindPayloadObject(root);
    if (!payload->is_object())
    {
        return BuildErrorEvent(lila::shared::errors::ChatActionInvalidPayload);
    }

    ChatEvent event;
    event.type = ChatEventType::MessageUpserted;
    event.messages.push_back(ParseChatMessage(*payload, currentUserId, nowUtc));
    return event;
}

ChatEvent ParseMessageDeletedEvent(const nlohmann::json& root)
{
    const auto* payload = FindPayloadObject(root);
    if (!payload->is_object())
    {
        return BuildErrorEvent(lila::shared::errors::ChatActionInvalidPayload);
    }

    ChatEvent event;
    event.type = ChatEventType::MessageDeleted;
    event.deletedMessageId = ReadRequiredString(*payload, lila::modules::chat::infrastructure::fields::Id.data());
    return event;
}

ChatEvent ParseErrorEvent(const nlohmann::json& root)
{
    ChatEvent event;
    event.type = ChatEventType::Error;
    const auto* payload = FindPayloadObjectOrRoot(root);
    const auto* errorContainer = FindErrorContainer(root, *payload);
    lila::modules::chat::domain::ChatServerError serverError;
    serverError.message = ReadOptionalString(
        *errorContainer,
        lila::modules::chat::infrastructure::fields::ErrorMessage.data());
    serverError.reason = ReadOptionalString(
        *errorContainer,
        lila::modules::chat::infrastructure::fields::ErrorReason.data());
    if (serverError.message.empty())
    {
        serverError.message = ReadOptionalString(
            *payload,
            lila::modules::chat::infrastructure::fields::ErrorMessage.data());
    }
    if (serverError.message.empty())
    {
        serverError.message = ReadOptionalString(
            *payload,
            lila::shared::network::realtime::fields::Error.data());
    }
    if (serverError.reason.empty())
    {
        serverError.reason = ReadOptionalString(
            *payload,
            lila::modules::chat::infrastructure::fields::ErrorReason.data());
    }
    serverError.untilUtc = lila::shared::data::datetime::ParseIsoTimestamp(
        ReadOptionalString(
            *errorContainer,
            lila::modules::chat::infrastructure::fields::ErrorUntil.data()));
    if (serverError.message.empty())
    {
        serverError.message = lila::shared::errors::ChatErrorMessage;
    }

    event.error = serverError;
    return event;
}
}
