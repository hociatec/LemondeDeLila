#include "modules/chat/infrastructure/ChatEventPayloadCodec.h"
#include "modules/chat/infrastructure/ChatEventPayloadParser.h"

#include "modules/chat/infrastructure/ChatProtocolFields.h"
#include "shared/data/json/JsonReaders.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/domain/WsMessageTypes.h"

#include <exception>

#include <nlohmann/json.hpp>

namespace lila::modules::chat::infrastructure::codec
{
using lila::shared::data::json::ReadRequiredString;

ChatEvent ParseEvent(const std::string& rawJson, int currentUserId, std::time_t nowUtc)
{
    try
    {
        const auto root = lila::shared::data::json::ParseDocument(rawJson, lila::shared::errors::ChatEventPayloadInvalid);
        if (!root.is_object())
        {
            return detail::BuildErrorEvent(lila::shared::errors::ChatEventDataInvalid);
        }

        const std::string type = ReadRequiredString(root, lila::modules::chat::infrastructure::fields::Type.data());
        if (!detail::IsChatEventType(type))
        {
            ChatEvent event;
            event.type = ChatEventType::Ignored;
            return event;
        }

        if (type == lila::shared::network::ws::types::chat::History)
        {
            return detail::ParseHistoryEvent(root, currentUserId, nowUtc);
        }

        if (type == lila::shared::network::ws::types::chat::Message ||
            type == lila::shared::network::ws::types::chat::MessageUpdated)
        {
            return detail::ParseMessageUpsertEvent(root, currentUserId, nowUtc);
        }

        if (type == lila::shared::network::ws::types::chat::MessageDeleted)
        {
            return detail::ParseMessageDeletedEvent(root);
        }

        return detail::ParseErrorEvent(root);
    }
    catch (const std::exception& error)
    {
        lila::shared::logging::LogWarning("ChatProtocol", error.what());
        return detail::BuildErrorEvent(lila::shared::errors::ChatEventDataInvalid);
    }
}
}
