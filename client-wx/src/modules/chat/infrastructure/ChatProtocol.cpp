#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/chat/infrastructure/ChatEventPayloadCodec.h"

namespace lila::modules::chat::infrastructure
{
std::string ChatProtocol::BuildSendPayload(const std::string& text) const
{
    return codec::BuildSendPayload(text);
}

std::string ChatProtocol::BuildEditPayload(const std::string& messageId, const std::string& text) const
{
    return codec::BuildEditPayload(messageId, text);
}

std::string ChatProtocol::BuildDeletePayload(const std::string& messageId) const
{
    return codec::BuildDeletePayload(messageId);
}

ChatEvent ChatProtocol::ParseEvent(const std::string& rawJson, int currentUserId, std::time_t nowUtc) const
{
    return codec::ParseEvent(rawJson, currentUserId, nowUtc);
}
}
