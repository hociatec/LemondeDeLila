#pragma once

#include "modules/chat/application/IChatProtocol.h"

namespace lila::modules::chat::infrastructure
{
using ChatEventType = application::ChatEventType;
using ChatEvent = application::ChatEvent;
using IChatProtocol = application::IChatProtocol;

class ChatProtocol final : public IChatProtocol
{
public:
    [[nodiscard]] std::string BuildSendPayload(const std::string& text) const override;
    [[nodiscard]] std::string BuildEditPayload(const std::string& messageId, const std::string& text) const override;
    [[nodiscard]] std::string BuildDeletePayload(const std::string& messageId) const override;
    [[nodiscard]] ChatEvent ParseEvent(const std::string& rawJson, int currentUserId, std::time_t nowUtc) const override;
};
}
