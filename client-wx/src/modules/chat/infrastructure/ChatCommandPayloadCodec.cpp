#include "modules/chat/infrastructure/ChatEventPayloadCodec.h"

#include "modules/chat/infrastructure/ChatProtocolFields.h"
#include "shared/network/domain/WsMessageTypes.h"

#include <nlohmann/json.hpp>

namespace lila::modules::chat::infrastructure::codec
{
std::string BuildSendPayload(const std::string& text)
{
    return nlohmann::json({
        {std::string(lila::modules::chat::infrastructure::fields::Type), lila::shared::network::ws::types::chat::Send},
        {std::string(lila::modules::chat::infrastructure::fields::Text), text},
    }).dump();
}

std::string BuildEditPayload(const std::string& messageId, const std::string& text)
{
    return nlohmann::json({
        {std::string(lila::modules::chat::infrastructure::fields::Type), lila::shared::network::ws::types::chat::Edit},
        {std::string(lila::modules::chat::infrastructure::fields::MessageId), messageId},
        {std::string(lila::modules::chat::infrastructure::fields::Text), text},
    }).dump();
}

std::string BuildDeletePayload(const std::string& messageId)
{
    return nlohmann::json({
        {std::string(lila::modules::chat::infrastructure::fields::Type), lila::shared::network::ws::types::chat::Delete},
        {std::string(lila::modules::chat::infrastructure::fields::MessageId), messageId},
    }).dump();
}
}

