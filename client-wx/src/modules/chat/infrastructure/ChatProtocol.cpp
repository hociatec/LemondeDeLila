#include "modules/chat/infrastructure/ChatProtocol.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/data/JsonReaders.h"
#include "shared/data/DateTime.h"
#include "shared/errors/ErrorMessages.h"

#include <ctime>
#include <stdexcept>
#include <optional>

#include <nlohmann/json.hpp>

namespace
{
using lila::modules::chat::domain::ChatServerError;
using lila::modules::chat::infrastructure::ChatEvent;
using lila::modules::chat::infrastructure::ChatEventType;

using lila::shared::data::json::ReadOptionalInteger;
using lila::shared::data::json::ReadOptionalString;

bool IsChatEventType(const std::string& type)
{
    return type == std::string(lila::shared::contracts::chat::HistoryEvent) ||
        type == std::string(lila::shared::contracts::chat::MessageEvent) ||
        type == std::string(lila::shared::contracts::chat::MessageUpdatedEvent) ||
        type == std::string(lila::shared::contracts::chat::MessageDeletedEvent) ||
        type == std::string(lila::shared::contracts::chat::ErrorEvent);
}

const nlohmann::json* FindPayloadObject(const nlohmann::json& root)
{
    const auto payloadIterator = root.find(std::string(lila::shared::contracts::chat::PayloadField));
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
    const auto payloadIterator = root.find(std::string(lila::shared::contracts::chat::PayloadField));
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
    const auto errorIterator = root.find(std::string(lila::shared::contracts::realtime::ErrorField));
    if (errorIterator != root.end() && errorIterator->is_object())
    {
        return &(*errorIterator);
    }

    const auto payloadErrorIterator = payload.find(std::string(lila::shared::contracts::realtime::ErrorField));
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
    message.id = lila::shared::data::json::ReadOptionalString(
        payload, lila::shared::contracts::chat::IdField.data());
    message.text = lila::shared::data::json::ReadOptionalString(
        payload, lila::shared::contracts::chat::TextField.data());
    if (message.text.empty())
    {
        message.text = ReadOptionalString(payload, lila::shared::contracts::chat::MessageField.data());
    }

    if (payload.contains(std::string(lila::shared::contracts::chat::UserField)) &&
        payload[std::string(lila::shared::contracts::chat::UserField)].is_object())
    {
        const auto& user = payload[std::string(lila::shared::contracts::chat::UserField)];
        message.user = ReadOptionalString(user, lila::shared::contracts::chat::UsernameField.data());
        message.userId = ReadOptionalInteger(user, lila::shared::contracts::chat::IdField.data());
    }
    else
    {
        message.user = ReadOptionalString(payload, lila::shared::contracts::chat::FromField.data());
    }

    message.timestampUtc = lila::shared::data::datetime::ParseIsoTimestamp(
        ReadOptionalString(payload, lila::shared::contracts::chat::CreatedAtField.data()))
                              .value_or(nowUtc);
    message.isMine = message.userId != 0 && message.userId == currentUserId;
    return message;
}
}

namespace lila::modules::chat::infrastructure
{
std::string ChatProtocol::BuildSendPayload(const std::string& text) const
{
    return nlohmann::json({
        {std::string(lila::shared::contracts::chat::TypeField), lila::shared::contracts::chat::SendEvent},
        {std::string(lila::shared::contracts::chat::TextField), text},
    }).dump();
}

std::string ChatProtocol::BuildEditPayload(const std::string& messageId, const std::string& text) const
{
    return nlohmann::json({
        {std::string(lila::shared::contracts::chat::TypeField), lila::shared::contracts::chat::EditEvent},
        {std::string(lila::shared::contracts::chat::MessageIdField), messageId},
        {std::string(lila::shared::contracts::chat::TextField), text},
    }).dump();
}

std::string ChatProtocol::BuildDeletePayload(const std::string& messageId) const
{
    return nlohmann::json({
        {std::string(lila::shared::contracts::chat::TypeField), lila::shared::contracts::chat::DeleteEvent},
        {std::string(lila::shared::contracts::chat::MessageIdField), messageId},
    }).dump();
}

ChatEvent ChatProtocol::ParseEvent(const std::string& rawJson, int currentUserId, std::time_t nowUtc) const
{
    try
    {
        const auto root = lila::shared::data::json::ParseDocument(rawJson, lila::shared::errors::ChatEventPayloadInvalid);
        if (!root.is_object())
        {
            return BuildErrorEvent(lila::shared::errors::ChatEventDataInvalid);
        }

        const std::string type = ReadOptionalString(root, lila::shared::contracts::chat::TypeField.data());
        if (!IsChatEventType(type))
        {
            return BuildErrorEvent(lila::shared::errors::ChatEventDataInvalid);
        }

        if (type == lila::shared::contracts::chat::HistoryEvent)
        {
            ChatEvent event;
            event.type = ChatEventType::History;
            event.editWindowSeconds = ReadOptionalInteger(
                root, lila::shared::contracts::chat::EditWindowSecondsField.data());
            const auto& messagesIterator =
                RequireArrayField(root, lila::shared::contracts::chat::MessagesField.data(), lila::shared::errors::ChatMessagesMustBeArray);
            for (const auto& item : messagesIterator)
            {
                if (!item.is_object())
                {
                    return BuildErrorEvent(lila::shared::errors::ChatEventDataInvalid);
                }
                event.messages.push_back(ParseChatMessage(item, currentUserId, nowUtc));
            }

            return event;
        }

        if (
            type == lila::shared::contracts::chat::MessageEvent ||
            type == lila::shared::contracts::chat::MessageUpdatedEvent)
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

        if (type == lila::shared::contracts::chat::MessageDeletedEvent)
        {
            const auto* payload = FindPayloadObject(root);
            if (!payload->is_object())
            {
                return BuildErrorEvent(lila::shared::errors::ChatActionInvalidPayload);
            }

            ChatEvent event;
            event.type = ChatEventType::MessageDeleted;
            event.deletedMessageId = ReadOptionalString(*payload, lila::shared::contracts::chat::IdField.data());
            return event;
        }

        ChatEvent event;
        event.type = ChatEventType::Error;
        const auto* payload = FindPayloadObjectOrRoot(root);
        const auto* errorContainer = FindErrorContainer(root, *payload);
        domain::ChatServerError serverError;
        serverError.message = ReadOptionalString(
            *errorContainer,
            lila::shared::contracts::chat::ErrorMessageField.data());
        serverError.reason = ReadOptionalString(
            *errorContainer,
            lila::shared::contracts::chat::ErrorReasonField.data());
        if (serverError.message.empty())
        {
            serverError.message = ReadOptionalString(
                *payload,
                lila::shared::contracts::chat::ErrorMessageField.data());
        }
        if (serverError.message.empty())
        {
            serverError.message = ReadOptionalString(
                *payload,
                lila::shared::contracts::realtime::ErrorField.data());
        }
        if (serverError.reason.empty())
        {
            serverError.reason = ReadOptionalString(
                *payload,
                lila::shared::contracts::chat::ErrorReasonField.data());
        }
        serverError.untilUtc = lila::shared::data::datetime::ParseIsoTimestamp(
            ReadOptionalString(
                *errorContainer,
                lila::shared::contracts::chat::ErrorUntilField.data()));
        if (serverError.message.empty())
        {
            serverError.message = lila::shared::errors::ChatErrorMessage;
        }

        event.error = serverError;
        return event;
    }
    catch (const std::exception&)
    {
        return BuildErrorEvent(lila::shared::errors::ChatEventDataInvalid);
    }
}
}
