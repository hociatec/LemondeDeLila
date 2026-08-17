#include "modules/chat/infrastructure/ChatProtocol.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

#include <ctime>
#include <iomanip>
#include <optional>
#include <sstream>

#include <nlohmann/json.hpp>

namespace
{
using lila::shared::data::json::ReadOptionalInteger;
using lila::shared::data::json::ReadOptionalString;

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
        message.user = ReadOptionalString(
            payload[std::string(lila::shared::contracts::chat::UserField)],
            lila::shared::contracts::chat::UsernameField.data());
        message.userId = ReadOptionalInteger(
            payload[std::string(lila::shared::contracts::chat::UserField)],
            lila::shared::contracts::chat::IdField.data());
    }
    else
    {
        message.user = ReadOptionalString(payload, lila::shared::contracts::chat::FromField.data());
    }

    message.timestampUtc = ParseIsoTimestamp(
        ReadOptionalString(payload, lila::shared::contracts::chat::CreatedAtField.data())).value_or(nowUtc);
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
    ChatEvent event;
    const std::string errorEventLiteral = std::string(lila::shared::contracts::chat::ErrorEvent);
    if (rawJson.find(std::string(lila::shared::contracts::chat::HistoryEvent)) == std::string::npos &&
        rawJson.find(std::string(lila::shared::contracts::chat::MessageEvent)) == std::string::npos &&
        rawJson.find("\"type\":\"" + errorEventLiteral + "\"") == std::string::npos &&
        rawJson.find("\"type\": \"" + errorEventLiteral + "\"") == std::string::npos)
    {
        return event;
    }

    const auto root = lila::shared::data::json::ParseDocument(rawJson, lila::shared::errors::ChatEventInvalid);
    if (!root.is_object())
    {
        return event;
    }

    const std::string type = ReadOptionalString(root, lila::shared::contracts::chat::TypeField.data());
    if (type == lila::shared::contracts::chat::HistoryEvent)
    {
        event.type = ChatEventType::History;
        event.editWindowSeconds = ReadOptionalInteger(
            root, lila::shared::contracts::chat::EditWindowSecondsField.data());
        const auto messagesIterator = root.find(std::string(lila::shared::contracts::chat::MessagesField));
        if (messagesIterator != root.end() && messagesIterator->is_array())
        {
            for (const auto& item : *messagesIterator)
            {
                event.messages.push_back(ParseChatMessage(item, currentUserId, nowUtc));
            }
        }
        return event;
    }

    if (
        type == lila::shared::contracts::chat::MessageEvent ||
        type == lila::shared::contracts::chat::MessageUpdatedEvent)
    {
        event.type = ChatEventType::MessageUpserted;
        const nlohmann::json payload = root.contains(std::string(lila::shared::contracts::chat::PayloadField)) &&
                                           root[std::string(lila::shared::contracts::chat::PayloadField)].is_object()
                                           ? root[std::string(lila::shared::contracts::chat::PayloadField)]
                                           : root;
        event.messages.push_back(ParseChatMessage(payload, currentUserId, nowUtc));
        return event;
    }

    if (type == lila::shared::contracts::chat::MessageDeletedEvent)
    {
        event.type = ChatEventType::MessageDeleted;
        const nlohmann::json payload = root.contains(std::string(lila::shared::contracts::chat::PayloadField)) &&
                                           root[std::string(lila::shared::contracts::chat::PayloadField)].is_object()
                                           ? root[std::string(lila::shared::contracts::chat::PayloadField)]
                                           : root;
        event.deletedMessageId = ReadOptionalString(payload, lila::shared::contracts::chat::IdField.data());
        return event;
    }

    if (type == lila::shared::contracts::chat::ErrorEvent)
    {
        event.type = ChatEventType::Error;
        domain::ChatServerError serverError;
        if (root.contains(std::string(lila::shared::contracts::chat::PayloadField)) &&
            root[std::string(lila::shared::contracts::chat::PayloadField)].is_object())
        {
            const auto& payload = root[std::string(lila::shared::contracts::chat::PayloadField)];
            serverError.message = ReadOptionalString(
                payload, lila::shared::contracts::chat::ErrorMessageField.data());
            serverError.reason = ReadOptionalString(
                payload, lila::shared::contracts::chat::ErrorReasonField.data());
            serverError.untilUtc =
                ParseIsoTimestamp(ReadOptionalString(
                    payload, lila::shared::contracts::chat::ErrorUntilField.data()));
        }

        if (serverError.message.empty())
        {
            serverError.message = lila::shared::errors::ChatErrorMessage;
        }

        event.error = serverError;
    }

    return event;
}
}
