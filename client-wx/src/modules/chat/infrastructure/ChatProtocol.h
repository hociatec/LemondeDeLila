#pragma once

#include <ctime>
#include <optional>
#include <string>
#include <vector>

#include "modules/chat/domain/ChatMessage.h"
#include "modules/chat/domain/ChatServerError.h"

namespace lila::modules::chat::infrastructure
{
enum class ChatEventType
{
    Ignored,
    History,
    MessageUpserted,
    MessageDeleted,
    Error,
};

struct ChatEvent final
{
    ChatEventType type = ChatEventType::Ignored;
    std::vector<domain::ChatMessage> messages;
    std::string deletedMessageId;
    int editWindowSeconds = 0;
    std::optional<domain::ChatServerError> error;
};

class IChatProtocol
{
public:
    virtual ~IChatProtocol() = default;
    [[nodiscard]] virtual std::string BuildSendPayload(const std::string& text) const = 0;
    [[nodiscard]] virtual std::string BuildEditPayload(const std::string& messageId, const std::string& text) const = 0;
    [[nodiscard]] virtual std::string BuildDeletePayload(const std::string& messageId) const = 0;
    [[nodiscard]] virtual ChatEvent ParseEvent(const std::string& rawJson, int currentUserId, std::time_t nowUtc) const = 0;
};

class ChatProtocol final : public IChatProtocol
{
public:
    [[nodiscard]] std::string BuildSendPayload(const std::string& text) const override;
    [[nodiscard]] std::string BuildEditPayload(const std::string& messageId, const std::string& text) const override;
    [[nodiscard]] std::string BuildDeletePayload(const std::string& messageId) const override;
    [[nodiscard]] ChatEvent ParseEvent(const std::string& rawJson, int currentUserId, std::time_t nowUtc) const override;
};
}
